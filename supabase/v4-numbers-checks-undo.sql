-- v4: certificate and record numbers, mandatory-field checks, undo for wrong entries, richer reports.
-- Run once, after v3-ids-trash-branding.sql. Nothing here drops a table, column or policy.

-- ---------- brand extras ----------
alter table settings add column if not exists default_theme text not null default 'dark';
alter table settings add column if not exists reg_no text;
alter table settings add column if not exists signatory2_name text;
alter table settings add column if not exists signatory2_title text default 'Secretary';
create or replace function public_brand() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('brand_name',brand_name,'tagline',tagline,'logo_url',logo_url,'brand_color',brand_color,'club_name',club_name,
    'address',address,'contact_phone',contact_phone,'contact_email',contact_email,'signatory_name',signatory_name,'signatory_title',signatory_title,
    'signatory2_name',signatory2_name,'signatory2_title',signatory2_title,'reg_no',reg_no,'default_theme',default_theme)
  from settings where id=1 $$;
grant execute on function public_brand() to anon, authenticated;

-- ---------- more serial numbers (same style as donor_no, camp_no) ----------
create or replace function add_serial(t text, col text) returns void language plpgsql as $$
declare seq text := t||'_'||col||'_seq'; mx int;
begin
  execute format('create sequence if not exists %I', seq);
  execute format('alter table %I add column if not exists %I int', t, col);
  execute format('update %I x set %I=o.n from (select ctid c, row_number() over (order by created_at, ctid) n from %I) o where x.ctid=o.c and x.%I is null', t, col, t, col);
  execute format('select coalesce(max(%I),0) from %I', col, t) into mx;
  execute format('select setval(%L, %s, false)', seq, mx+1);
  execute format('alter table %I alter column %I set default nextval(%L)', t, col, seq);
  execute format('alter table %I alter column %I set not null', t, col);
  execute format('create unique index if not exists %I on %I(%I)', t||'_'||col||'_uq', t, col);
end $$;
select add_serial('donations','cert_no');
select add_serial('handovers','handover_no');
select add_serial('sponsors','sponsor_no');
select add_serial('expenses','expense_no');
select add_serial('camp_volunteers','volunteer_no');
revoke execute on function add_serial(text,text) from public, anon, authenticated;

-- sample birthdays that landed in the future
update donors set dob = dob - interval '30 years' where dob > current_date - interval '18 years' and source='sample';

-- ---------- validation (friendly messages; runs on every insert and update) ----------
create or replace function validate_row() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_table_name='donors' then
    if length(trim(coalesce(new.full_name,'')))<2 then raise exception 'Enter the donor''s full name'; end if;
    if new.phone !~ '^[6-9][0-9]{9}$' then raise exception 'Mobile number must be 10 digits and start with 6, 7, 8 or 9'; end if;
    if new.dob is not null and new.dob > current_date then raise exception 'Date of birth cannot be in the future'; end if;
    if new.dob is not null and new.dob < current_date - interval '100 years' then raise exception 'Check the date of birth'; end if;
    if new.last_donation is not null and new.last_donation > current_date then raise exception 'Last donation date cannot be in the future'; end if;
    if new.email is not null and new.email <> '' and new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email or leave it empty'; end if;
    new.full_name := trim(new.full_name);
  elsif tg_table_name='camps' then
    if length(trim(coalesce(new.name,'')))<3 then raise exception 'Enter the camp name'; end if;
    if new.camp_date is null then raise exception 'Choose the camp date'; end if;
    if coalesce(trim(new.venue),'')='' then raise exception 'Enter the venue'; end if;
    if new.start_time is null or new.end_time is null then raise exception 'Enter start and end time'; end if;
    if new.end_time <= new.start_time then raise exception 'End time must be after start time'; end if;
    if new.target_donors is not null and new.target_donors < 1 then raise exception 'Target donors must be at least 1'; end if;
  elsif tg_table_name='emergency_requests' then
    if coalesce(trim(new.hospital),'')='' then raise exception 'Enter the hospital'; end if;
    if new.units_needed not between 1 and 20 then raise exception 'Units needed must be between 1 and 20'; end if;
    if new.contact_phone is not null and new.contact_phone<>'' and regexp_replace(new.contact_phone,'\D','','g') !~ '^[0-9]{10,12}$' then raise exception 'Enter a valid contact phone'; end if;
  elsif tg_table_name='camp_volunteers' then
    if length(trim(coalesce(new.name,'')))<2 then raise exception 'Enter the volunteer''s name'; end if;
    if new.phone is not null and new.phone<>'' and new.phone !~ '^[6-9][0-9]{9}$' then raise exception 'Volunteer mobile must be 10 digits'; end if;
  elsif tg_table_name='sponsors' then
    if length(trim(coalesce(new.name,'')))<2 then raise exception 'Enter the sponsor name'; end if;
    if new.amount is null or new.amount <= 0 then raise exception 'Sponsor amount must be more than 0'; end if;
  elsif tg_table_name='expenses' then
    if new.amount is null or new.amount <= 0 then raise exception 'Expense amount must be more than 0'; end if;
    if coalesce(trim(new.description),'')='' then raise exception 'Say what the expense was for'; end if;
  elsif tg_table_name='tasks' then
    if length(trim(coalesce(new.title,'')))<2 then raise exception 'Enter the task'; end if;
  elsif tg_table_name='blood_units' then
    if coalesce(trim(new.bag_number),'')='' then raise exception 'Enter the bag number'; end if;
    if new.volume_ml is not null and new.volume_ml not between 100 and 500 then raise exception 'Volume must be between 100 and 500 ml'; end if;
    if new.expiry_date is not null and new.expiry_date < new.collected_on then raise exception 'Expiry date cannot be before the collection date'; end if;
    if new.collected_on > current_date then raise exception 'Collection date cannot be in the future'; end if;
  elsif tg_table_name='screenings' then
    if new.hb is not null and new.hb not between 3 and 25 then raise exception 'Hb must be between 3 and 25 g/dL'; end if;
    if new.weight_kg is not null and new.weight_kg not between 25 and 250 then raise exception 'Weight must be between 25 and 250 kg'; end if;
    if new.systolic is not null and new.systolic not between 60 and 260 then raise exception 'Upper BP must be between 60 and 260'; end if;
    if new.diastolic is not null and new.diastolic not between 30 and 160 then raise exception 'Lower BP must be between 30 and 160'; end if;
    if new.systolic is not null and new.diastolic is not null and new.diastolic >= new.systolic then raise exception 'Lower BP must be less than upper BP'; end if;
    if new.pulse is not null and new.pulse not between 30 and 220 then raise exception 'Pulse must be between 30 and 220'; end if;
    if new.decision='eligible' and (new.hb is null or new.weight_kg is null or new.systolic is null or new.diastolic is null or new.pulse is null)
      then raise exception 'Enter Hb, weight, BP and pulse before clearing a donor'; end if;
  elsif tg_table_name='profiles' then
    if new.phone is not null and new.phone<>'' and new.phone !~ '^[6-9][0-9]{9}$' then raise exception 'Mobile number must be 10 digits'; end if;
  end if;
  return new; end $$;
do $$ declare t text; begin
  foreach t in array array['donors','camps','emergency_requests','camp_volunteers','sponsors','expenses','tasks','blood_units','screenings','profiles'] loop
    execute format('create or replace trigger validate_%1$s before insert or update on %1$I for each row execute function validate_row()', t);
  end loop; end $$;

-- ---------- undo: audit keeps a full snapshot (hidden from the API) and the transaction id ----------
alter table audit_logs add column if not exists txid bigint;
alter table audit_logs add column if not exists snapshot jsonb;
alter table audit_logs add column if not exists reverted_at timestamptz;
alter table audit_logs add column if not exists reverted_by uuid;
alter table audit_logs add column if not exists is_revert boolean not null default false;
create index if not exists audit_logs_txid on audit_logs(txid);
revoke select on audit_logs from anon, authenticated;
grant select (id,at,actor,actor_name,table_name,action,row_id,changes,txid,reverted_at,reverted_by,is_revert) on audit_logs to authenticated;
create policy "audit read own" on audit_logs for select using (actor = auth.uid());

create or replace function audit_row() returns trigger language plpgsql security definer set search_path=public as $$
declare o jsonb := case when tg_op<>'INSERT' then to_jsonb(old) end; n jsonb := case when tg_op<>'DELETE' then to_jsonb(new) end;
  ch jsonb; k text; hidden text[] := array['hb','systolic','diastolic','weight_kg','pulse','defer_reason','notes','reaction','updated_at','consent_at','logo_data'];
begin
  if tg_op='UPDATE' then
    ch := '{}'::jsonb;
    for k in select jsonb_object_keys(n) loop
      if (o->k) is distinct from (n->k) and k<>'updated_at' then
        ch := ch || jsonb_build_object(k, case when k=any(hidden) then '"(changed)"'::jsonb else jsonb_build_object('from',o->k,'to',n->k) end); end if;
    end loop;
    if ch='{}'::jsonb then return new; end if;
  else
    ch := coalesce(n,o);
    foreach k in array hidden loop ch := ch - k; end loop;
  end if;
  insert into audit_logs(actor,actor_name,table_name,action,row_id,changes,txid,snapshot,is_revert)
  values(auth.uid(),(select full_name from profiles where id=auth.uid()),tg_table_name,lower(tg_op),
    coalesce(n->>'id',o->>'id',n->>'registration_id',o->>'registration_id',n->>'blood_group',o->>'blood_group'),ch,txid_current(),case when tg_op='INSERT' then n else o end,coalesce(current_setting('app.reverting',true),'')='1');
  return coalesce(new,old); end $$;

create or replace function _pk(t text) returns text language sql stable as $$
  select a.attname::text from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
  where i.indrelid=('public.'||t)::regclass and i.indisprimary limit 1 $$;

-- Reverses every change made in one transaction (one save, delete or camp-day step).
create or replace function _revert_tx(p_txid bigint) returns int language plpgsql security definer set search_path=public as $$
declare r record; pk text; cols text; n int := 0;
  rank jsonb := '{"profiles":0,"camps":1,"donors":1,"handovers":1,"registrations":2,"screenings":3,"donations":3,"blood_units":4}';
begin
  if exists(select 1 from audit_logs where txid=p_txid and reverted_at is null and table_name not in
     ('donors','camps','registrations','screenings','donations','blood_units','handovers','emergency_requests','tasks','camp_volunteers','sponsors','expenses',
      'settings','message_templates','stock_thresholds','profiles')) then raise exception 'This change cannot be undone'; end if;
  if exists(select 1 from audit_logs where txid=p_txid and reverted_at is null and table_name in ('profiles','settings') and action<>'update') then
    raise exception 'Adding or removing users and settings cannot be undone here'; end if;
  perform set_config('app.reverting','1',true);
  -- refuse when a later change touched the same record
  if exists(select 1 from audit_logs e join audit_logs l on l.table_name=e.table_name and l.row_id=e.row_id and l.id>e.id and l.txid<>e.txid and l.reverted_at is null and not l.is_revert
            where e.txid=p_txid and e.reverted_at is null
              and (l.action='delete' or e.action<>'update' or (l.changes ?| array(select jsonb_object_keys(e.changes)))))
  then raise exception 'This record was changed again later. Undo the later change first.'; end if;
  -- 1. put deleted rows back, parents first
  for r in select * from audit_logs where txid=p_txid and reverted_at is null and action='delete' order by coalesce((rank->>table_name)::int,5), id loop
    execute format('insert into %I select * from jsonb_populate_record(null::%I, $1)', r.table_name, r.table_name) using r.snapshot; n:=n+1;
  end loop;
  -- 2. set changed columns back to their old values, newest first
  for r in select * from audit_logs where txid=p_txid and reverted_at is null and action='update' order by id desc loop
    pk := _pk(r.table_name);
    select string_agg(quote_ident(k),',') into cols from jsonb_object_keys(r.changes) k where k not in ('id','created_at','donor_no','camp_no','member_no','req_no','token_no','cert_no','handover_no','sponsor_no','expense_no','volunteer_no');
    if cols is null then continue; end if;
    execute format('update %I set (%s) = (select %s from jsonb_populate_record(null::%I, $1)) where %I::text = $2', r.table_name, cols, cols, r.table_name, pk)
      using r.snapshot, r.snapshot->>pk; n:=n+1;
  end loop;
  -- 3. remove rows that were added, children first
  for r in select * from audit_logs where txid=p_txid and reverted_at is null and action='insert' order by coalesce((rank->>table_name)::int,5) desc, id desc loop
    pk := _pk(r.table_name);
    execute format('delete from %I where %I::text = $1', r.table_name, pk) using r.snapshot->>pk; n:=n+1;
  end loop;
  update audit_logs set reverted_at=now(), reverted_by=auth.uid() where txid=p_txid and reverted_at is null;
  perform set_config('app.reverting','',true);
  return n; end $$;

-- Undo one action from the audit log. Allowed for people with the Audit permission,
-- or for anyone undoing their own change from the last 24 hours.
create or replace function revert_change(p_id bigint) returns int language plpgsql security definer set search_path=public as $$
declare a audit_logs; begin
  select * into a from audit_logs where id=p_id;
  if a.id is null then raise exception 'Change not found'; end if;
  if a.reverted_at is not null then raise exception 'This change was already undone'; end if;
  if not (perm('audit') or (a.actor=auth.uid() and a.at > now()-interval '24 hours')) then
    raise exception 'You can only undo your own changes from the last 24 hours'; end if;
  return _revert_tx(a.txid); end $$;

-- Undo the signed-in person's most recent action (used by the Undo button on messages).
create or replace function undo_my_last() returns int language plpgsql security definer set search_path=public as $$
declare t bigint; begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select txid into t from audit_logs where actor=auth.uid() and reverted_at is null and not is_revert and at > now()-interval '24 hours' order by id desc limit 1;
  if t is null then raise exception 'Nothing to undo'; end if;
  return _revert_tx(t); end $$;

-- Camp day: take a donor back one step (donated -> cleared, cleared/deferred -> checked in)
create or replace function revert_step(p_reg uuid) returns text language plpgsql security definer set search_path=public as $$
declare st text; t bigint; begin
  if not perm('screening') then raise exception 'Only medical staff can take a donor back a step'; end if;
  select status into st from registrations where id=p_reg;
  if st='donated' then
    select txid into t from audit_logs where table_name='donations' and row_id=p_reg::text and action='insert' and reverted_at is null order by id desc limit 1;
  elsif st in ('screened','deferred') then
    select txid into t from audit_logs where table_name='screenings' and row_id=p_reg::text and reverted_at is null order by id desc limit 1;
  else raise exception 'Nothing to take back for this donor'; end if;
  if t is null then raise exception 'No recorded step found to take back'; end if;
  perform _revert_tx(t);
  return (select status from registrations where id=p_reg); end $$;

revoke execute on function _revert_tx(bigint), _pk(text) from public, anon, authenticated;
revoke execute on function revert_change(bigint), undo_my_last(), revert_step(uuid) from public, anon;
grant execute on function revert_change(bigint), undo_my_last(), revert_step(uuid) to authenticated;

-- ---------- richer read functions (new names; the old ones stay) ----------
create or replace function camp_board(p_camp uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not (perm('campday') or perm('screening')) then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(x order by x.token_no) from (
    select r.id reg_id, r.token_no, r.slot, r.status, d.donor_no, d.full_name,
      case when perm('donors') or perm('screening') then d.phone else 'XXXXXX'||right(d.phone,4) end phone,
      d.blood_group, d.gender, d.last_donation, n.bag_number, n.volume_ml, n.cert_no
    from registrations r join donors d on d.id=r.donor_id left join donations n on n.registration_id=r.id where r.camp_id=p_camp) x),'[]'::jsonb);
end $$;

create or replace function camp_report_full(p_camp uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not perm('reports') then raise exception 'Not allowed'; end if;
  return camp_report(p_camp) || jsonb_build_object(
    'camp_no',(select camp_no from camps where id=p_camp),
    'start_time',(select start_time from camps where id=p_camp),'end_time',(select end_time from camps where id=p_camp),
    'donors',coalesce((select jsonb_agg(jsonb_build_object('token',r.token_no,'donor_no',d.donor_no,'name',d.full_name,'group',d.blood_group,'gender',d.gender,
        'status',r.status,'bag',n.bag_number,'volume',n.volume_ml,'cert_no',n.cert_no) order by r.token_no)
      from registrations r join donors d on d.id=r.donor_id left join donations n on n.registration_id=r.id where r.camp_id=p_camp),'[]'::jsonb),
    'sponsor_list',coalesce((select jsonb_agg(jsonb_build_object('no',sponsor_no,'name',name,'amount',amount,'received',received) order by sponsor_no) from sponsors where camp_id=p_camp),'[]'::jsonb),
    'expense_list',coalesce((select jsonb_agg(jsonb_build_object('no',expense_no,'category',category,'description',description,'amount',amount,'date',spent_on) order by spent_on,expense_no) from expenses where camp_id=p_camp),'[]'::jsonb),
    'volunteer_list',coalesce((select jsonb_agg(jsonb_build_object('no',volunteer_no,'name',name,'desk',desk,'shift',shift,'attended',attended) order by name) from camp_volunteers where camp_id=p_camp),'[]'::jsonb));
end $$;

create or replace function my_portal() returns jsonb language plpgsql security definer set search_path=public as $$
declare d donors; begin
  select * into d from donors where user_id=auth.uid() and deleted_at is null;
  return jsonb_build_object(
    'donor', case when d.id is null then null else jsonb_build_object('name',d.full_name,'donor_no',d.donor_no,'blood_group',d.blood_group,'gender',d.gender,'last_donation',d.last_donation) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('code',upper(left(r.id::text,8)),'cert_no',n.cert_no,'camp',c.name,'venue',c.venue,'date',c.camp_date,'volume',n.volume_ml) order by c.camp_date desc)
      from registrations r join donations n on n.registration_id=r.id join camps c on c.id=r.camp_id where r.donor_id=d.id),'[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('camp_id',c.id,'camp',c.name,'date',c.camp_date,'venue',c.venue,'slot',r.slot,'token_no',r.token_no) order by c.camp_date)
      from registrations r join camps c on c.id=r.camp_id where r.donor_id=d.id and r.status in ('registered','checked_in') and c.status in ('open','live','planned') and c.deleted_at is null),'[]'::jsonb),
    'open_camps', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'date',c.camp_date,'venue',c.venue,'start_time',c.start_time,'end_time',c.end_time) order by c.camp_date)
      from camps c where c.status='open' and c.deleted_at is null),'[]'::jsonb));
end $$;

-- accepts CRT-000012, 12, or the older 8-character code
create or replace function verify_certificate(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; c text := upper(regexp_replace(coalesce(p_code,''),'\s','','g')); n int; begin
  if c ~ '^(CRT-?)?[0-9]{1,9}$' then n := regexp_replace(c,'[^0-9]','','g')::int; end if;
  if n is null and length(c)<>8 then return jsonb_build_object('error','not found'); end if;
  select jsonb_build_object('name',trim(split_part(d.full_name,' ',1)||' '||left(regexp_replace(d.full_name,'^\S+\s*',''),1)),
    'camp',cp.name,'venue',cp.venue,'date',cp.camp_date,'blood_group',d.blood_group,'volume',dn.volume_ml,'cert_no',dn.cert_no,
    'code',upper(left(rg.id::text,8)),'donor_no',d.donor_no,'club',(select club_name from settings where id=1)) into r
  from donations dn join registrations rg on rg.id=dn.registration_id join donors d on d.id=rg.donor_id join camps cp on cp.id=rg.camp_id
  where (n is not null and dn.cert_no=n) or (n is null and upper(left(rg.id::text,8))=c) limit 1;
  return coalesce(r,jsonb_build_object('error','not found')); end $$;
grant execute on function verify_certificate(text) to anon, authenticated;
grant execute on function camp_board(uuid), camp_report_full(uuid) to authenticated;
revoke execute on function camp_board(uuid), camp_report_full(uuid) from public, anon;
revoke execute on function validate_row() from public, anon, authenticated;

-- ---------- live updates ----------
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['profiles','donors','camps','registrations','screenings','donations','handovers','blood_units','stock_thresholds',
                             'emergency_requests','tasks','camp_volunteers','sponsors','expenses','settings','message_log'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table %I', t); end if;
    end loop; end if; end $$;

-- public registration now returns the donor's token number
create or replace function register_for_camp(p_camp uuid,p_name text,p_phone text,p_group blood_group,p_dob date,p_area text,p_slot text,p_consent boolean)
returns text language plpgsql security definer set search_path=public as $$
declare d uuid; tk int; begin
  if not p_consent then raise exception 'Consent is required'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Enter your full name'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number'; end if;
  if p_dob is null or p_dob > current_date - interval '18 years' or p_dob < current_date - interval '66 years' then raise exception 'Donors must be 18 to 65 years old'; end if;
  if not exists(select 1 from camps where id=p_camp and status='open' and deleted_at is null) then raise exception 'Registration for this camp is closed'; end if;
  if slot_is_full(p_camp,p_slot) then raise exception 'This time slot is full. Choose another slot.'; end if;
  insert into donors(full_name,phone,blood_group,dob,area,consent,consent_at,source)
  values(trim(p_name),p_phone,p_group,p_dob,nullif(trim(p_area),''),true,now(),'public_form')
  on conflict(phone) do update set consent=true, consent_at=coalesce(donors.consent_at,now()), deleted_at=null, deleted_by=null returning id into d;
  insert into registrations(camp_id,donor_id,slot) values(p_camp,d,p_slot) on conflict do nothing;
  select token_no into tk from registrations where camp_id=p_camp and donor_id=d;
  return coalesce(tk::text,'ok'); end $$;
