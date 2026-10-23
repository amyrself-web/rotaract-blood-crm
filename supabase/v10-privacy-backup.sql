-- v10: donor privacy (consent history, data requests, erase a donor), and backup reminders. Run once, after v9.

-- ---------- consent history ----------
create table if not exists consent_log(
  id uuid primary key default gen_random_uuid(),
  donor_id uuid references donors on delete cascade,
  consent boolean not null, source text, changed_by uuid default auth.uid(), created_at timestamptz not null default now());
alter table consent_log enable row level security;
create policy "consent log read" on consent_log for select using (perm('donors') or perm('settings'));
grant select on consent_log to authenticated;
create index if not exists consent_log_donor on consent_log(donor_id, created_at desc);

create or replace function log_consent() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' or new.consent is distinct from old.consent then
    insert into consent_log(donor_id,consent,source) values(new.id,new.consent,
      case when coalesce(current_setting('app.erasing',true),'')='1' then 'erased'
           when auth.uid() is null then 'system (WhatsApp STOP or import)'
           when new.user_id=auth.uid() then 'donor' else 'staff' end);
  end if; return new; end $$;
create or replace trigger consent_history after insert or update of consent on donors for each row execute function log_consent();
insert into consent_log(donor_id,consent,source,created_at,changed_by)
  select id,consent,'at start of history',coalesce(consent_at,created_at),null from donors d
  where not exists(select 1 from consent_log c where c.donor_id=d.id);

-- ---------- data requests ----------
create sequence if not exists privacy_request_no_seq;
create table if not exists privacy_requests(
  id uuid primary key default gen_random_uuid(),
  request_no int not null unique default nextval('privacy_request_no_seq'),
  donor_id uuid references donors on delete set null,
  name text not null, phone text,
  kind text not null check (kind in ('copy','correct','erase','stop')),
  details text, status text not null default 'open' check (status in ('open','done','rejected')),
  outcome text, created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  closed_at timestamptz, closed_by uuid);
alter table privacy_requests enable row level security;
create policy "privacy staff" on privacy_requests for all using (perm('settings') or perm('donors')) with check (perm('settings') or perm('donors'));
create policy "privacy own read" on privacy_requests for select using (donor_id in (select id from donors where user_id=auth.uid()));
grant select, insert, update on privacy_requests to authenticated;
create or replace trigger audit_privacy_requests after insert or update or delete on privacy_requests for each row execute function audit_row();

-- the donor (signed in to the portal) asks for something about their data
create or replace function request_my_privacy(p_kind text, p_details text default null) returns int language plpgsql security definer set search_path=public as $$
declare d donors; n int; begin
  select * into d from donors where user_id=auth.uid() and deleted_at is null;
  if d.id is null then raise exception 'Your login is not linked to a donor record'; end if;
  if p_kind not in ('copy','correct','erase','stop') then raise exception 'Unknown request'; end if;
  if exists(select 1 from privacy_requests where donor_id=d.id and kind=p_kind and status='open') then raise exception 'You already have this request open. The club will contact you.'; end if;
  insert into privacy_requests(donor_id,name,phone,kind,details) values(d.id,d.full_name,d.phone,p_kind,left(p_details,1000)) returning request_no into n;
  if p_kind='stop' then perform set_config('app.reverting','1',true); update donors set consent=false where id=d.id; perform set_config('app.reverting','',true); end if;
  return n; end $$;

-- everything the CRM holds about one donor, as one document (for the donor, or for staff answering a request)
create or replace function donor_data(p_donor uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare d donors; begin
  if p_donor is null then select * into d from donors where user_id=auth.uid();
  else if not (perm('donors') or perm('settings')) then raise exception 'Not allowed'; end if; select * into d from donors where id=p_donor; end if;
  if d.id is null then raise exception 'Donor not found'; end if;
  return jsonb_build_object(
    'exported_at',now(),'club',(select club_name from settings where id=1),
    'donor',to_jsonb(d)-'user_id'-'deleted_by',
    'camps',coalesce((select jsonb_agg(jsonb_build_object('camp',c.name,'date',c.camp_date,'venue',c.venue,'status',r.status,'slot',r.slot,
        'screening',(select to_jsonb(s)-'screened_by'-'registration_id' from screenings s where s.registration_id=r.id),
        'donation',(select jsonb_build_object('bag',x.bag_number,'volume_ml',x.volume_ml,'reaction',x.reaction,'certificate',x.cert_no) from donations x where x.registration_id=r.id)) order by c.camp_date)
      from registrations r join camps c on c.id=r.camp_id where r.donor_id=d.id),'[]'),
    'history',coalesce((select jsonb_agg(to_jsonb(e)-'donor_id'-'created_by' order by e.event_date) from donor_events e where e.donor_id=d.id),'[]'),
    'messages',coalesce((select jsonb_agg(jsonb_build_object('kind',o.kind,'text',o.body,'status',o.status,'sent_at',o.sent_at) order by o.created_at) from wa_outbox o where o.donor_id=d.id),'[]'),
    'consent_history',coalesce((select jsonb_agg(jsonb_build_object('consent',l.consent,'source',l.source,'at',l.created_at) order by l.created_at) from consent_log l where l.donor_id=d.id),'[]'),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('request',p.request_no,'kind',p.kind,'status',p.status,'at',p.created_at,'outcome',p.outcome)) from privacy_requests p where p.donor_id=d.id),'[]'));
end $$;

-- erase: personal details are removed for good; blood group, gender and donation counts stay so camp totals do not change
do $$ declare d text; begin
  select pg_get_functiondef('public.validate_row'::regproc) into d;
  if position('app.erasing' in d)=0 then
    d := replace(d, $x$if new.phone !~ '^[6-9][0-9]{9}$' then raise exception 'Mobile number must be 10 digits$x$,
                    $x$if new.phone !~ '^[6-9][0-9]{9}$' and coalesce(current_setting('app.erasing',true),'')<>'1' then raise exception 'Mobile number must be 10 digits$x$);
    execute d; end if; end $$;
alter table wa_outbox drop constraint if exists wa_outbox_phone_check;
alter table wa_outbox add constraint wa_outbox_phone_check check (phone ~ '^[6-9][0-9]{9}$' or phone='erased');

create or replace function erase_donor(p_donor uuid, p_request uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare d donors; keys text[] := array['full_name','phone','email','dob','area','user_id','consent_at']; k text; begin
  if not perm('settings') then raise exception 'Only people with the Settings permission can erase a donor'; end if;
  select * into d from donors where id=p_donor; if d.id is null then raise exception 'Donor not found'; end if;
  perform set_config('app.erasing','1',true); perform set_config('app.reverting','1',true);
  update donors set full_name='Erased donor '||lpad(donor_no::text,4,'0'), phone='E'||lpad(donor_no::text,9,'0'), email=null, dob=null, area=null,
    consent=false, user_id=null, deleted_at=coalesce(deleted_at,now()) where id=p_donor;
  update donor_events set place=null, notes=null where donor_id=p_donor;
  update wa_outbox set phone='erased', name=null, body='[erased]', vars=null, status=case when status='queued' then 'cancelled' else status end where donor_id=p_donor;
  update members set donor_id=null where donor_id=p_donor;
  update privacy_requests set name='Erased donor', phone=null, details=null where donor_id=p_donor;
  update audit_logs set changes=changes-keys, snapshot=snapshot-keys where table_name='donors' and row_id=p_donor::text;
  insert into wa_optout(phone,reason) values(d.phone,'Donor data erased') on conflict (phone) do update set active=true, reason='Donor data erased';
  if p_request is not null then update privacy_requests set status='done', outcome='Personal details erased', closed_at=now(), closed_by=auth.uid() where id=p_request; end if;
  perform set_config('app.erasing','',true); perform set_config('app.reverting','',true);
end $$;

grant execute on function request_my_privacy(text,text), donor_data(uuid), erase_donor(uuid,uuid) to authenticated;
revoke execute on function request_my_privacy(text,text), donor_data(uuid), erase_donor(uuid,uuid), log_consent() from public, anon;

-- ---------- backups ----------
alter table settings add column if not exists last_backup_at timestamptz;
create or replace function mark_backup() returns void language plpgsql security definer set search_path=public as $$
begin if not perm('settings') then raise exception 'Not allowed'; end if;
  perform set_config('app.reverting','1',true); update settings set last_backup_at=now() where id=1; perform set_config('app.reverting','',true); end $$;
grant execute on function mark_backup() to authenticated; revoke execute on function mark_backup() from public, anon;
