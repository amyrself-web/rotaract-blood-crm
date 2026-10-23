-- v9: WhatsApp sending. Messages go into an outbox; then one of:
--   'manual': "tap to send": the app opens WhatsApp with the message ready, a person presses send (free, no setup)
--   'qr'    : the club's own WhatsApp number, linked by scanning a QR code (sender program on any always-on computer or old phone, see whatsapp-worker/)
--   'cloud' : the official WhatsApp Cloud API from Meta (Edge Function wa-cloud)
-- Daily automatic messages (birthday, eligible again, camp reminders, next-day thank-you with certificate) are queued by wa_daily_rules().
-- Run once, after v8.

create table if not exists wa_settings(
  id int primary key default 1 check (id=1),
  provider text not null default 'manual' check (provider in ('manual','qr','cloud')),
  per_minute int not null default 6 check (per_minute between 1 and 30),
  daily_cap int not null default 250 check (daily_cap between 1 and 5000),
  quiet_from time not null default '21:00', quiet_to time not null default '08:00',
  site_url text,
  auto jsonb not null default '{"birthday":true,"eligible_again":true,"reminder_1d":true,"reminder_today":true,"followup":true,"meeting_1d":false}',
  cloud_phone_id text, cloud_templates jsonb not null default '{}', last_rules_at timestamptz, last_rules jsonb,
  updated_at timestamptz default now());
insert into wa_settings(id) values(1) on conflict do nothing;
alter table wa_settings enable row level security;
create policy "wa settings read" on wa_settings for select using (perm('messages') or perm('settings'));
create policy "wa settings write" on wa_settings for update using (perm('settings')) with check (perm('settings'));
grant select, update on wa_settings to authenticated;

-- written only by the worker (service role); the app reads it through wa_status()
create table if not exists wa_session(
  id int primary key default 1 check (id=1),
  status text not null default 'offline' check (status in ('offline','starting','qr','connected','logged_out')),
  qr text, phone text, name text, last_seen timestamptz, command text, worker_version text, updated_at timestamptz default now());
insert into wa_session(id) values(1) on conflict do nothing;
alter table wa_session enable row level security;

create table if not exists wa_optout(phone text primary key, reason text, active boolean not null default true, created_at timestamptz not null default now());
alter table wa_optout enable row level security;
create policy "wa optout read" on wa_optout for select using (perm('messages'));
create policy "wa optout manage" on wa_optout for all using (perm('messages')) with check (perm('messages'));
grant select, insert, update, delete on wa_optout to authenticated;

create sequence if not exists wa_broadcast_no_seq;
create table if not exists wa_broadcasts(
  id uuid primary key default gen_random_uuid(),
  broadcast_no int not null unique default nextval('wa_broadcast_no_seq'),
  title text not null, kind text not null, total int not null default 0,
  created_by uuid default auth.uid(), created_at timestamptz not null default now());
alter table wa_broadcasts enable row level security;
create policy "wa broadcasts read" on wa_broadcasts for select using (perm('messages'));
grant select on wa_broadcasts to authenticated;

create table if not exists wa_outbox(
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid references wa_broadcasts on delete set null,
  kind text not null, ref text,
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'), name text,
  donor_id uuid references donors on delete set null, member_id uuid references members on delete set null,
  body text not null check (length(body) between 1 and 4000), vars jsonb,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','cancelled')),
  send_after timestamptz not null default now(),
  attempts int not null default 0, claimed_at timestamptz, error text, provider text, provider_msg_id text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), sent_at timestamptz);
create index if not exists wa_outbox_queue on wa_outbox(status, send_after);
create unique index if not exists wa_outbox_once on wa_outbox(kind, ref, phone) where ref is not null;
alter table wa_outbox enable row level security;
create policy "wa outbox read" on wa_outbox for select using (perm('messages'));
grant select on wa_outbox to authenticated;

-- ---------- helpers ----------
create or replace function wa_fill(p_body text, v jsonb) returns text language plpgsql immutable set search_path=public as $$
declare k text; out text := p_body; begin
  for k in select jsonb_object_keys(v) loop out := replace(out,'{'||k||'}',coalesce(v->>k,'')); end loop;
  return regexp_replace(out,'\{[a-z_]+\}','','g'); end $$;

create or replace function wa_template(p_kind text) returns text language sql stable security definer set search_path=public as $$
  select coalesce((select body from message_templates where kind=p_kind), case p_kind
    when 'birthday' then 'Happy Birthday {name}! Wishing you good health and happiness. - {club}'
    when 'eligible_again' then 'Hello {name}, you are eligible to donate blood again. Join our next camp and save lives. - {club}'
    when 'reminder_1d' then 'Hello {name}, a reminder that {camp} is tomorrow ({date}) at {venue}. Your slot: {slot}. Please eat well, drink water and bring a photo ID. - {club}'
    when 'reminder_today' then 'Good morning {name}! {camp} is today at {venue}. Your slot: {slot}. See you there. - {club}'
    when 'followup' then 'Thank you {name} for donating blood at {camp} yesterday. We hope you are feeling well; drink plenty of water today. Download your certificate here: {link} - {club}'
    when 'meeting_1d' then 'Hello {name}, reminder: {meeting} is tomorrow ({date}) at {time}, {venue}. Please mark your attendance with the QR code at the meeting. - {club}'
    when 'emergency' then 'URGENT: {group} blood needed at {hospital}. If you can donate today, please call {contact}. - {club}'
    else '{body}' end) $$;

create or replace function wa_ist_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;
-- first moment after now that is outside quiet hours (Indian time)
create or replace function wa_next_slot(p_at timestamptz default now()) returns timestamptz language plpgsql stable security definer set search_path=public as $$
declare s wa_settings; t time := (p_at at time zone 'Asia/Kolkata')::time; d date := (p_at at time zone 'Asia/Kolkata')::date; begin
  select * into s from wa_settings where id=1;
  if s.quiet_from > s.quiet_to then   -- e.g. 21:00 to 08:00, over midnight
    if t >= s.quiet_from then return ((d+1)+s.quiet_to) at time zone 'Asia/Kolkata'; end if;
    if t < s.quiet_to then return (d+s.quiet_to) at time zone 'Asia/Kolkata'; end if;
  elsif t >= s.quiet_from and t < s.quiet_to then return (d+s.quiet_to) at time zone 'Asia/Kolkata'; end if;
  return p_at; end $$;

-- ---------- queue messages from the app ----------
-- p_items: [{phone,name,body,donor_id,member_id,ref}]
create or replace function wa_enqueue(p_title text, p_kind text, p_items jsonb, p_send_after timestamptz default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b uuid; bno int; n int := 0; skipped int := 0; x jsonb; ph text; at timestamptz; begin
  if not perm('messages') then raise exception 'You do not have permission to send messages'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Nobody to send to'; end if;
  if jsonb_array_length(p_items)>3000 then raise exception 'Send to at most 3000 people at a time'; end if;
  at := wa_next_slot(greatest(coalesce(p_send_after,now()),now()));
  insert into wa_broadcasts(title,kind) values(left(coalesce(nullif(trim(p_title),''),p_kind),120),p_kind) returning id,broadcast_no into b,bno;
  for x in select * from jsonb_array_elements(p_items) loop
    ph := right(regexp_replace(coalesce(x->>'phone',''),'\D','','g'),10);
    if ph !~ '^[6-9][0-9]{9}$' or exists(select 1 from wa_optout where phone=ph and active) or length(coalesce(x->>'body',''))<1 then skipped:=skipped+1; continue; end if;
    insert into wa_outbox(broadcast_id,kind,ref,phone,name,donor_id,member_id,body,vars,send_after)
      values(b,p_kind,nullif(x->>'ref',''),ph,x->>'name',nullif(x->>'donor_id','')::uuid,nullif(x->>'member_id','')::uuid,left(x->>'body',4000),x->'vars',at)
      on conflict do nothing;
    if found then n:=n+1; else skipped:=skipped+1; end if;
  end loop;
  update wa_broadcasts set total=n where id=b;
  return jsonb_build_object('broadcast_no',bno,'queued',n,'skipped',skipped,'send_after',at); end $$;

create or replace function wa_cancel(p_ids uuid[] default null, p_broadcast uuid default null) returns int language plpgsql security definer set search_path=public as $$
declare n int; begin
  if not perm('messages') then raise exception 'Not allowed'; end if;
  update wa_outbox set status='cancelled' where status='queued' and (id=any(p_ids) or broadcast_id=p_broadcast);
  get diagnostics n=row_count; return n; end $$;

create or replace function wa_retry(p_ids uuid[]) returns int language plpgsql security definer set search_path=public as $$
declare n int; begin
  if not perm('messages') then raise exception 'Not allowed'; end if;
  update wa_outbox set status='queued',error=null,send_after=wa_next_slot(now()) where status in ('failed','cancelled') and id=any(p_ids) and not exists(select 1 from wa_optout o where o.phone=wa_outbox.phone and o.active);
  get diagnostics n=row_count; return n; end $$;

-- status for the app; the linking QR is shown only to people with the Settings permission
create or replace function wa_status() returns jsonb language plpgsql security definer set search_path=public as $$
declare s wa_session; w wa_settings; begin
  if not (perm('messages') or perm('settings')) then raise exception 'Not allowed'; end if;
  select * into s from wa_session where id=1; select * into w from wa_settings where id=1;
  return jsonb_build_object('provider',w.provider,'per_minute',w.per_minute,'daily_cap',w.daily_cap,'status',case when s.last_seen<now()-interval '2 minutes' then 'offline' else s.status end,
    'qr',case when perm('settings') and s.last_seen>now()-interval '2 minutes' then s.qr end,'phone',s.phone,'name',s.name,'last_seen',s.last_seen,'worker_version',s.worker_version,
    'queued',(select count(*) from wa_outbox where status in ('queued','sending')),
    'sent_today',(select count(*) from wa_outbox where status='sent' and sent_at>=(wa_ist_today()::timestamp at time zone 'Asia/Kolkata')),
    'failed_today',(select count(*) from wa_outbox where status='failed' and created_at>=(wa_ist_today()::timestamp at time zone 'Asia/Kolkata')),
    'next_at',(select min(send_after) from wa_outbox where status='queued')); end $$;

create or replace function wa_command(p_cmd text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not perm('settings') then raise exception 'Only people with the Settings permission can do this'; end if;
  if p_cmd not in ('logout','restart') then raise exception 'Unknown command'; end if;
  update wa_session set command=p_cmd, updated_at=now() where id=1; end $$;

-- ---------- used by the sender (service role only) ----------
create or replace function wa_claim(p_limit int default 1) returns setof wa_outbox language plpgsql security definer set search_path=public as $$
declare w wa_settings; done_today int; begin
  select * into w from wa_settings where id=1;
  -- a sender that stopped half way: put its messages back in the queue
  update wa_outbox set status='queued' where status='sending' and claimed_at<now()-interval '10 minutes';
  if w.provider not in ('qr','cloud') or wa_next_slot(now())>now() then return; end if;
  select count(*) into done_today from wa_outbox where status='sent' and sent_at>=(wa_ist_today()::timestamp at time zone 'Asia/Kolkata');
  if done_today>=w.daily_cap then return; end if;
  return query update wa_outbox o set status='sending', attempts=o.attempts+1, provider=w.provider, claimed_at=now()
    where o.id in (select id from wa_outbox where status='queued' and send_after<=now()
                   and not exists(select 1 from wa_optout x where x.phone=wa_outbox.phone and x.active)
                   order by send_after, created_at limit least(p_limit, w.daily_cap-done_today) for update skip locked)
    returning o.*;
end $$;

create or replace function wa_result(p_id uuid, p_ok boolean, p_error text default null, p_msg_id text default null) returns void
language plpgsql security definer set search_path=public as $$
declare o wa_outbox; begin
  update wa_outbox set status=case when p_ok then 'sent' when attempts<3 and coalesce(p_error,'') ilike 'retry:%' then 'queued' else 'failed' end,
    error=case when p_ok then null else left(p_error,300) end, provider_msg_id=p_msg_id, sent_at=case when p_ok then now() end,
    send_after=case when not p_ok then now()+interval '5 minutes' else send_after end
  where id=p_id returning * into o;
  if p_ok and o.donor_id is not null then
    insert into message_log(donor_id,kind,ref) values(o.donor_id,o.kind,coalesce(o.ref,o.id::text)) on conflict do nothing;
    if o.kind in ('followup','certificate') then update donations set cert_sent_at=now(), cert_issued_at=coalesce(cert_issued_at,now()) where registration_id::text=o.ref; end if;
  end if; end $$;

create or replace function wa_optout_add(p_phone text, p_reason text default 'Replied STOP') returns void language plpgsql security definer set search_path=public as $$
declare ph text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),10); begin
  if length(ph)<>10 then return; end if;
  insert into wa_optout(phone,reason) values(ph,p_reason) on conflict (phone) do update set active=true, reason=excluded.reason, created_at=now();
  update wa_outbox set status='cancelled', error='Opted out' where phone=ph and status='queued';
  perform set_config('app.reverting','1',true);
  update donors set consent=false where phone=ph and consent;
  perform set_config('app.reverting','',true); end $$;
create or replace function wa_optout_remove(p_phone text) returns void language plpgsql security definer set search_path=public as $$
declare ph text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),10); begin
  update wa_optout set active=false, reason='Replied START' where phone=ph; end $$;

create or replace function wa_heartbeat(p_status text, p_qr text default null, p_phone text default null, p_name text default null, p_version text default null) returns text
language plpgsql security definer set search_path=public as $$
declare c text; begin
  update wa_session set status=p_status, qr=case when p_status='qr' then p_qr end, phone=coalesce(p_phone,case when p_status='logged_out' then null else phone end),
    name=coalesce(p_name,case when p_status='logged_out' then null else name end), last_seen=now(), worker_version=coalesce(p_version,worker_version), updated_at=now()
  where id=1 returning command into c;
  if c is not null then update wa_session set command=null where id=1; end if;
  return c; end $$;

-- ---------- daily automatic messages ----------
create or replace function wa_daily_rules(p_day date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare w wa_settings; d date := coalesce(p_day,wa_ist_today()); club text; site text; at timestamptz; out jsonb := '{}'; n int; begin
  if auth.uid() is not null and not perm('messages') then raise exception 'Not allowed'; end if;
  select * into w from wa_settings where id=1; select club_name into club from settings where id=1;
  site := coalesce(nullif(w.site_url,''),'');
  at := wa_next_slot(greatest(now(), ((d+time '09:00') at time zone 'Asia/Kolkata')));

  -- each rule: who, with which words; body = template filled with the words, vars kept for Cloud API templates
  if coalesce((w.auto->>'birthday')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'birthday',extract(year from d)::text,x.phone,x.full_name,x.id,wa_fill(wa_template('birthday'),v),v,at,null
    from donors x cross join lateral (select jsonb_build_object('name',x.full_name,'club',club) v) j
    where x.deleted_at is null and x.consent and x.dob is not null and to_char(x.dob,'MM-DD')=to_char(d,'MM-DD') and x.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('birthday',n); end if;

  if coalesce((w.auto->>'eligible_again')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'eligible_again',x.last_donation::text,x.phone,x.full_name,x.id,wa_fill(wa_template('eligible_again'),v),v,at,null
    from donors x cross join settings s cross join lateral (select jsonb_build_object('name',x.full_name,'club',club) v) j
    where s.id=1 and x.deleted_at is null and x.consent and x.last_donation is not null and x.phone ~ '^[6-9][0-9]{9}$'
      and x.last_donation + case when x.gender='Female' then s.gap_female else s.gap_male end between d-3 and d
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('eligible_again',n); end if;

  if coalesce((w.auto->>'reminder_1d')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'reminder_1d',c.id::text,x.phone,x.full_name,x.id,wa_fill(wa_template('reminder_1d'),v),v,at,null
    from registrations r join camps c on c.id=r.camp_id join donors x on x.id=r.donor_id
      cross join lateral (select jsonb_build_object('name',x.full_name,'club',club,'camp',c.name,'date',to_char(c.camp_date,'DD Mon YYYY'),'venue',coalesce(c.venue,'the venue'),'slot',coalesce(r.slot::text,'any time')) v) j
    where c.camp_date=d+1 and c.deleted_at is null and r.status='registered' and x.deleted_at is null and x.consent and x.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('reminder_1d',n); end if;

  if coalesce((w.auto->>'reminder_today')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'reminder_today',c.id::text,x.phone,x.full_name,x.id,wa_fill(wa_template('reminder_today'),v),v,
      wa_next_slot(greatest(now(),((d+time '07:00') at time zone 'Asia/Kolkata'))),null
    from registrations r join camps c on c.id=r.camp_id join donors x on x.id=r.donor_id
      cross join lateral (select jsonb_build_object('name',x.full_name,'club',club,'camp',c.name,'venue',coalesce(c.venue,'the venue'),'slot',coalesce(r.slot::text,'any time')) v) j
    where c.camp_date=d and c.deleted_at is null and r.status='registered' and x.deleted_at is null and x.consent and x.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('reminder_today',n); end if;

  if coalesce((w.auto->>'followup')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'followup',r.id::text,x.phone,x.full_name,x.id,wa_fill(wa_template('followup'),v),v,at,null
    from donations dn join registrations r on r.id=dn.registration_id join camps c on c.id=r.camp_id join donors x on x.id=r.donor_id
      cross join lateral (select jsonb_build_object('name',x.full_name,'club',club,'camp',c.name,
        'link',case when site<>'' and dn.verify_code is not null then site||'#/certificate/'||substr(dn.verify_code,1,4)||'-'||substr(dn.verify_code,5,4)||'-'||substr(dn.verify_code,9,4) else '' end) v) j
    where c.camp_date=d-1 and x.deleted_at is null and x.consent and x.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('followup',n); end if;

  if coalesce((w.auto->>'meeting_1d')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,member_id,body,vars,send_after,created_by)
    select 'meeting_1d',mt.id::text,m.phone,m.full_name,m.id,wa_fill(wa_template('meeting_1d'),v),v,at,null
    from meetings mt cross join members m
      cross join lateral (select jsonb_build_object('name',m.full_name,'club',club,'meeting',mt.title,'date',to_char(mt.meeting_date,'DD Mon'),
        'time',coalesce(to_char(mt.start_time,'HH12:MI AM'),''),'venue',coalesce(mt.venue,case when mt.mode='Online' then 'online' else '' end)) v) j
    where mt.meeting_date=d+1 and mt.status='scheduled' and mt.deleted_at is null and m.deleted_at is null and m.status='active' and m.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=m.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('meeting_1d',n); end if;
  perform set_config('app.reverting','1',true);   -- bookkeeping, keep it out of the audit undo
  update wa_settings set last_rules_at=now(), last_rules=out where id=1;
  perform set_config('app.reverting','',true);
  return out; end $$;

-- "Tap to send" mode: the app opens WhatsApp with the message, the person presses send, and the app marks it sent
create or replace function wa_mark_sent(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare o wa_outbox; begin
  if not perm('messages') then raise exception 'Not allowed'; end if;
  update wa_outbox set status='sent', sent_at=now(), provider='manual', attempts=attempts+1, error=null where id=p_id and status in ('queued','failed') returning * into o;
  if o.donor_id is not null then
    insert into message_log(donor_id,kind,ref,sent_by) values(o.donor_id,o.kind,coalesce(o.ref,o.id::text),auth.uid()) on conflict do nothing;
    if o.kind in ('followup','certificate') then update donations set cert_sent_at=now(), cert_issued_at=coalesce(cert_issued_at,now()) where registration_id::text=o.ref; end if;
  end if; end $$;
grant execute on function wa_mark_sent(uuid) to authenticated;
revoke execute on function wa_mark_sent(uuid) from public, anon;

-- the certificate link in the follow-up message opens a page that rebuilds the certificate from its 12-character code
create or replace function certificate_by_code(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; c text := upper(regexp_replace(coalesce(p_code,''),'[^0-9A-Za-z]','','g')); g uuid; begin
  if length(c)<>12 then return jsonb_build_object('error','not found'); end if;
  select jsonb_build_object('name',d.full_name,'camp',cp.name,'venue',cp.venue,'date',cp.camp_date,'blood_group',d.blood_group,'volume',dn.volume_ml,
    'cert_no',dn.cert_no,'verify_code',dn.verify_code,'donor_no',d.donor_no), rg.id into r, g
  from donations dn join registrations rg on rg.id=dn.registration_id join donors d on d.id=rg.donor_id join camps cp on cp.id=rg.camp_id
  where dn.verify_code=c and d.deleted_at is null;
  if r is null then return jsonb_build_object('error','not found'); end if;
  perform set_config('app.reverting','1',true);
  update donations set cert_issued_at=coalesce(cert_issued_at,now()), cert_downloads=cert_downloads+1 where registration_id=g;
  perform set_config('app.reverting','',true);
  return r; end $$;
grant execute on function certificate_by_code(text) to anon, authenticated;

revoke execute on function wa_claim(int), wa_result(uuid,boolean,text,text), wa_heartbeat(text,text,text,text,text), wa_optout_add(text,text), wa_optout_remove(text) from public, anon, authenticated;
revoke execute on function wa_fill(text,jsonb), wa_template(text), wa_next_slot(timestamptz) from public, anon;
grant execute on function wa_enqueue(text,text,jsonb,timestamptz), wa_cancel(uuid[],uuid), wa_retry(uuid[]), wa_status(), wa_command(text), wa_daily_rules(date) to authenticated;
revoke execute on function wa_enqueue(text,text,jsonb,timestamptz), wa_cancel(uuid[],uuid), wa_retry(uuid[]), wa_status(), wa_command(text), wa_daily_rules(date) from public, anon;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function wa_claim(int), wa_result(uuid,boolean,text,text), wa_heartbeat(text,text,text,text,text), wa_optout_add(text,text), wa_optout_remove(text), wa_daily_rules(date) to service_role;
  grant select, insert, update on wa_outbox, wa_session, wa_settings, wa_optout to service_role; end if; end $$;

create or replace trigger audit_wa_settings after insert or update or delete on wa_settings for each row execute function audit_row();
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='wa_outbox') then alter publication supabase_realtime add table wa_outbox; end if;
  end if; end $$;

-- 08:00 Indian time every day (02:30 UTC). pg_cron is available on Supabase; skipped where it is not installed.
do $$ begin
  begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron not available: %', sqlerrm; end;
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('wa-daily-rules','30 2 * * *','select public.wa_daily_rules()'); end if; end $$;
