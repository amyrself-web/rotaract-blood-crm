-- v2: master user control, sub-roles (designations), per-user module permissions, settings,
-- audit log, slot capacity and edit/delete functions. Run once, after fix-02-grants.sql.

-- ---------- profiles: sub-role, email, per-user permission overrides ----------
alter table profiles add column if not exists designation text;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists updated_at timestamptz default now();
update profiles p set email=u.email from auth.users u where u.id=p.id and p.email is distinct from u.email;

create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path=public as
$$ begin insert into profiles(id,full_name,email) values(new.id,new.raw_user_meta_data->>'full_name',new.email) on conflict (id) do nothing; return new; end $$;
create or replace function sync_profile_email() returns trigger language plpgsql security definer set search_path=public as
$$ begin update profiles set email=new.email where id=new.id; return new; end $$;
create or replace trigger on_auth_user_email after update of email on auth.users for each row execute function sync_profile_email();

-- Modules a user can be given. Admin always has all of them.
create or replace function role_default_perms(r app_role) returns text[] language sql immutable as $$
  select case r
    when 'admin' then array['donors','camps','import','planning','campday','screening','messages','stock','stock_edit','emergency','reports','users','audit','settings']
    when 'coordinator' then array['donors','camps','import','planning','campday','messages','stock','emergency','reports']
    when 'medical' then array['campday','screening','stock','stock_edit','emergency']
    when 'volunteer' then array['campday']
    else array[]::text[] end $$;

create or replace function perm(m text) returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select case when p.role='admin' then true
      when p.permissions ? m then (p.permissions->>m)::boolean
      else m = any(role_default_perms(p.role)) end
    from profiles p where p.id=auth.uid() and p.active), false) $$;

create or replace function my_access() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('role',p.role,'designation',p.designation,'active',p.active,
    'perms',(select jsonb_object_agg(m, case when p.role='admin' then true when p.permissions ? m then (p.permissions->>m)::boolean else m=any(role_default_perms(p.role)) end)
             from unnest(role_default_perms('admin')) m))
  from profiles p where p.id=auth.uid() $$;

-- Guard: only admins touch admins; nobody locks out the last admin; people may edit their own name/phone only.
create or replace function guard_profile() returns trigger language plpgsql security definer set search_path=public as $$
declare me profiles; begin
  if auth.uid() is null then return coalesce(new,old); end if;          -- service role (user control service)
  select * into me from profiles where id=auth.uid();
  if tg_op='DELETE' then raise exception 'Remove users from the Users page'; end if;
  if not perm('users') and new.id<>auth.uid() then raise exception 'You do not have permission to manage users'; end if;
  if new.id=auth.uid() and not perm('users') then
    if new.role<>old.role or new.active<>old.active or new.permissions<>old.permissions or new.designation is distinct from old.designation
      then raise exception 'You can only change your own name and phone'; end if;
    return new; end if;
  if me.role<>'admin' and (old.role='admin' or new.role='admin') then raise exception 'Only an admin can change admin accounts'; end if;
  if old.role='admin' and (new.role<>'admin' or not new.active)
     and not exists(select 1 from profiles where role='admin' and active and id<>old.id) then raise exception 'Keep at least one active admin'; end if;
  new.updated_at:=now(); return new; end $$;
create or replace trigger guard_profile before update or delete on profiles for each row execute function guard_profile();

-- ---------- settings ----------
create table if not exists settings(
  id int primary key default 1 check (id=1),
  club_name text not null default 'Sankari Rotaract Club',
  min_hb numeric not null default 12.5, min_weight numeric not null default 45,
  gap_male int not null default 90, gap_female int not null default 120,
  expiry_days int not null default 35, default_slot_capacity int,
  updated_at timestamptz default now());
insert into settings(id) values(1) on conflict do nothing;
alter table settings enable row level security;
create policy "settings read" on settings for select to authenticated using (true);
create policy "settings write" on settings for update using (perm('settings')) with check (perm('settings'));

-- ---------- camps: slot capacity ----------
alter table camps add column if not exists slot_capacity int check (slot_capacity is null or slot_capacity>0);

-- ---------- policies: everything now follows perm(module) ----------
-- Existing policies keep their names; only their rules change (no policy is dropped).
alter policy "staff read all" on profiles using (perm('users'));
alter policy "admin update" on profiles using (perm('users') or id=auth.uid()) with check (perm('users') or id=auth.uid());
alter policy "staff manage donors" on donors using (perm('donors')) with check (perm('donors'));
alter policy "medical read donors" on donors using (perm('emergency'));
alter policy "staff manage camps" on camps using (perm('camps')) with check (perm('camps'));
alter policy "team read camps" on camps using (perm('campday') or perm('planning') or perm('messages') or perm('reports') or perm('stock') or perm('screening'));
alter policy "staff manage registrations" on registrations using (perm('camps')) with check (perm('camps'));
alter policy "team read registrations" on registrations using (perm('campday') or perm('messages') or perm('reports'));
alter policy "medical manage screenings" on screenings using (perm('screening')) with check (perm('screening'));
alter policy "medical manage donations" on donations using (perm('screening')) with check (perm('screening'));
alter policy "coordinator read donations" on donations using (perm('reports') or perm('stock') or perm('campday'));
alter policy "staff read templates" on message_templates using (perm('messages') or perm('settings'));
alter policy "admin write templates" on message_templates using (perm('settings')) with check (perm('settings'));
alter policy "staff manage message log" on message_log using (perm('messages')) with check (perm('messages'));
alter policy "staff read units" on blood_units using (perm('stock') or perm('emergency'));
alter policy "staff read handovers" on handovers using (perm('stock'));
alter policy "staff read thresholds" on stock_thresholds using (perm('stock'));
alter policy "admin write thresholds" on stock_thresholds using (perm('settings') or perm('stock_edit')) with check (perm('settings') or perm('stock_edit'));
alter policy "staff manage requests" on emergency_requests using (perm('emergency')) with check (perm('emergency'));
alter policy "medical read requests" on emergency_requests using (perm('emergency'));
alter policy "staff manage tasks" on tasks using (perm('planning')) with check (perm('planning'));
alter policy "staff manage volunteers" on camp_volunteers using (perm('planning')) with check (perm('planning'));
alter policy "staff manage sponsors" on sponsors using (perm('planning')) with check (perm('planning'));
alter policy "staff manage expenses" on expenses using (perm('planning')) with check (perm('planning'));

-- ---------- functions now check module permissions ----------
create or replace function camp_worklist(p_camp uuid)
returns table(reg_id uuid, slot text, status text, full_name text, phone text, blood_group blood_group, gender text, last_donation date, bag_number text, volume_ml int)
language plpgsql security definer set search_path=public as $$
begin
  if not (perm('campday') or perm('screening')) then raise exception 'Not allowed'; end if;
  return query
    select r.id, r.slot, r.status, d.full_name,
      case when perm('donors') or perm('screening') then d.phone else 'XXXXXX'||right(d.phone,4) end,
      d.blood_group, d.gender, d.last_donation, n.bag_number, n.volume_ml
    from registrations r join donors d on d.id=r.donor_id left join donations n on n.registration_id=r.id
    where r.camp_id=p_camp order by r.slot nulls last, d.full_name;
end $$;

create or replace function set_reg_status(p_reg uuid, p_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not perm('campday') then raise exception 'Not allowed'; end if;
  update registrations set status=p_status where id=p_reg and (
    (p_status='checked_in' and status in ('registered','no_show')) or (p_status='no_show' and status='registered')
    or (p_status='registered' and status in ('checked_in','no_show')));
  if not found then raise exception 'This donor cannot be moved to that step'; end if;
end $$;

create or replace function save_screening(p_reg uuid,p_hb numeric,p_sys int,p_dia int,p_wt numeric,p_pulse int,p_decision text,p_reason text,p_until date,p_notes text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not perm('screening') then raise exception 'Only medical staff can screen donors'; end if;
  if p_decision not in ('eligible','deferred') then raise exception 'Invalid decision'; end if;
  if p_decision='deferred' and coalesce(trim(p_reason),'')='' then raise exception 'Give a reason for deferral'; end if;
  if not exists(select 1 from registrations where id=p_reg and status in ('checked_in','screened','deferred')) then raise exception 'Donor must be checked in first'; end if;
  insert into screenings(registration_id,hb,systolic,diastolic,weight_kg,pulse,decision,defer_reason,defer_until,notes,screened_by)
  values(p_reg,p_hb,p_sys,p_dia,p_wt,p_pulse,p_decision,p_reason,p_until,p_notes,auth.uid())
  on conflict (registration_id) do update set hb=excluded.hb,systolic=excluded.systolic,diastolic=excluded.diastolic,weight_kg=excluded.weight_kg,
    pulse=excluded.pulse,decision=excluded.decision,defer_reason=excluded.defer_reason,defer_until=excluded.defer_until,notes=excluded.notes,screened_by=excluded.screened_by;
  update registrations set status=case when p_decision='eligible' then 'screened' else 'deferred' end where id=p_reg;
end $$;

create or replace function record_donation(p_reg uuid, p_bag text, p_vol int, p_reaction text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not perm('screening') then raise exception 'Only medical staff can record donations'; end if;
  if coalesce(trim(p_bag),'')='' then raise exception 'Enter the bag number'; end if;
  if not exists(select 1 from registrations where id=p_reg and status='screened') then raise exception 'Donor must be screened and cleared first'; end if;
  begin
    insert into donations(registration_id,bag_number,volume_ml,reaction,donated_by) values(p_reg,trim(p_bag),coalesce(p_vol,350),nullif(trim(p_reaction),''),auth.uid());
  exception when unique_violation then raise exception 'This bag number is already used';
  end;
  update registrations set status='donated' where id=p_reg;
  update donors set last_donation=current_date where id=(select donor_id from registrations where id=p_reg);
end $$;

-- capacity helper shared by all three registration paths
create or replace function slot_is_full(p_camp uuid, p_slot text) returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select c.slot_capacity is not null and p_slot is not null and
    (select count(*) from registrations r where r.camp_id=c.id and r.slot=p_slot and r.status<>'no_show') >= c.slot_capacity
    from camps c where c.id=p_camp), false) $$;

create or replace function camp_slots(p_camp uuid) returns table(slot text, taken int, capacity int)
language sql stable security definer set search_path=public as $$
  select r.slot, count(*)::int, (select slot_capacity from camps where id=p_camp)
  from registrations r join camps c on c.id=r.camp_id
  where r.camp_id=p_camp and r.slot is not null and r.status<>'no_show' and c.status in ('open','live') group by r.slot $$;

create or replace function register_for_camp(p_camp uuid,p_name text,p_phone text,p_group blood_group,p_dob date,p_area text,p_slot text,p_consent boolean)
returns text language plpgsql security definer set search_path=public as $$
declare d uuid; begin
  if not p_consent then raise exception 'Consent is required'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number'; end if;
  if p_dob is null or p_dob > current_date - interval '18 years' or p_dob < current_date - interval '66 years' then raise exception 'Donors must be 18 to 65 years old'; end if;
  if not exists(select 1 from camps where id=p_camp and status='open') then raise exception 'Registration for this camp is closed'; end if;
  if slot_is_full(p_camp,p_slot) then raise exception 'This time slot is full. Choose another slot.'; end if;
  insert into donors(full_name,phone,blood_group,dob,area,consent,consent_at,source)
  values(trim(p_name),p_phone,p_group,p_dob,nullif(trim(p_area),''),true,now(),'public_form')
  on conflict(phone) do update set consent=true, consent_at=coalesce(donors.consent_at,now()) returning id into d;
  insert into registrations(camp_id,donor_id,slot) values(p_camp,d,p_slot) on conflict do nothing;
  return 'ok'; end $$;

create or replace function register_me(p_camp uuid,p_slot text) returns text
language plpgsql security definer set search_path=public as $$
declare d uuid; begin
  select id into d from donors where user_id=auth.uid();
  if d is null then raise exception 'Link your donor record first'; end if;
  if not exists(select 1 from camps where id=p_camp and status='open') then raise exception 'Registration for this camp is closed'; end if;
  if slot_is_full(p_camp,p_slot) then raise exception 'This time slot is full. Choose another slot.'; end if;
  insert into registrations(camp_id,donor_id,slot) values(p_camp,d,p_slot)
  on conflict (camp_id,donor_id) do update set slot=excluded.slot where registrations.status='registered';
  return 'ok'; end $$;

create or replace function walk_in(p_camp uuid,p_name text,p_phone text,p_group blood_group,p_dob date,p_area text,p_consent boolean) returns text
language plpgsql security definer set search_path=public as $$
declare d uuid; begin
  if not perm('campday') then raise exception 'Not allowed'; end if;
  if not p_consent then raise exception 'Consent is required'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number'; end if;
  if p_dob is null or p_dob > current_date - interval '18 years' or p_dob < current_date - interval '66 years' then raise exception 'Donors must be 18 to 65 years old'; end if;
  if not exists(select 1 from camps where id=p_camp and status in ('open','live')) then raise exception 'This camp is not open'; end if;
  insert into donors(full_name,phone,blood_group,dob,area,consent,consent_at,source)
  values(trim(p_name),p_phone,p_group,p_dob,nullif(trim(p_area),''),true,now(),'walk_in')
  on conflict(phone) do update set consent=true, consent_at=coalesce(donors.consent_at,now()) returning id into d;
  insert into registrations(camp_id,donor_id,status) values(p_camp,d,'checked_in')
  on conflict (camp_id,donor_id) do update set status='checked_in' where registrations.status in ('registered','no_show');
  return 'ok'; end $$;

create or replace function donation_to_unit() returns trigger language plpgsql security definer set search_path=public as $$
declare days int := coalesce((select expiry_days from settings where id=1),35); begin
  insert into blood_units(bag_number,blood_group,volume_ml,collected_on,camp_id,donation_reg,expiry_date)
  select new.bag_number,d.blood_group,new.volume_ml,current_date,r.camp_id,new.registration_id,current_date+days
  from registrations r join donors d on d.id=r.donor_id where r.id=new.registration_id
  on conflict (bag_number) do nothing;
  return new; end $$;

create or replace function set_unit_status(p_unit uuid,p_status text,p_note text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not perm('stock_edit') then raise exception 'You do not have permission to change stock'; end if;
  if p_status not in ('collected','in_transit','testing','available','issued','discarded') then raise exception 'Invalid status'; end if;
  update blood_units set status=p_status, note=coalesce(nullif(trim(p_note),''),note), updated_at=now() where id=p_unit;
  if not found then raise exception 'Unit not found'; end if;
end $$;

create or replace function add_unit(p_bag text,p_group blood_group,p_vol int,p_collected date,p_status text) returns void
language plpgsql security definer set search_path=public as $$
declare days int := coalesce((select expiry_days from settings where id=1),35); begin
  if not perm('stock_edit') then raise exception 'You do not have permission to add stock'; end if;
  if coalesce(trim(p_bag),'')='' then raise exception 'Enter the bag number'; end if;
  begin
    insert into blood_units(bag_number,blood_group,volume_ml,collected_on,expiry_date,source,status)
    values(trim(p_bag),p_group,coalesce(p_vol,350),coalesce(p_collected,current_date),coalesce(p_collected,current_date)+days,'manual',coalesce(p_status,'available'));
  exception when unique_violation then raise exception 'This bag number already exists';
  end;
end $$;

create or replace function update_unit(p_unit uuid,p_bag text,p_group blood_group,p_vol int,p_collected date,p_expiry date,p_note text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not perm('stock_edit') then raise exception 'You do not have permission to edit stock'; end if;
  if coalesce(trim(p_bag),'')='' then raise exception 'Enter the bag number'; end if;
  begin
    update blood_units set bag_number=trim(p_bag), blood_group=p_group, volume_ml=p_vol, collected_on=p_collected, expiry_date=p_expiry,
      note=nullif(trim(p_note),''), updated_at=now() where id=p_unit;
  exception when unique_violation then raise exception 'This bag number already exists';
  end;
  if not found then raise exception 'Unit not found'; end if;
end $$;

-- Units added by hand can be removed; units from a recorded donation cannot (mark them discarded).
create policy "units remove manual" on blood_units for delete using (perm('stock_edit') and donation_reg is null);

create or replace function handover_units(p_units uuid[],p_bank text,p_notes text) returns void
language plpgsql security definer set search_path=public as $$
declare h uuid; n int; begin
  if not perm('stock') then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_bank),'')='' then raise exception 'Enter the blood bank name'; end if;
  insert into handovers(bank_name,notes) values(trim(p_bank),nullif(trim(p_notes),'')) returning id into h;
  update blood_units set status='in_transit', handover_id=h, updated_at=now() where id=any(p_units) and status='collected';
  get diagnostics n = row_count;
  if n=0 then raise exception 'No collected units were selected'; end if;
end $$;

-- camp_report: same body as phase 8, permission switched to perm('reports')
do $$ declare src text; begin
  select pg_get_functiondef('public.camp_report(uuid)'::regprocedure) into src;
  src := replace(src, 'has_role(array[''admin'',''coordinator'']::app_role[])', 'perm(''reports'')');
  execute src;
end $$;

-- ---------- audit log ----------
create table if not exists audit_logs(
  id bigserial primary key, at timestamptz not null default now(),
  actor uuid, actor_name text, table_name text not null, action text not null, row_id text, changes jsonb);
create index if not exists audit_logs_at on audit_logs(at desc);
alter table audit_logs enable row level security;
create policy "audit read" on audit_logs for select using (perm('audit'));

create or replace function audit_row() returns trigger language plpgsql security definer set search_path=public as $$
declare o jsonb := case when tg_op<>'INSERT' then to_jsonb(old) end; n jsonb := case when tg_op<>'DELETE' then to_jsonb(new) end;
  ch jsonb; k text; hidden text[] := array['hb','systolic','diastolic','weight_kg','pulse','defer_reason','notes','reaction','updated_at','consent_at'];
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
  insert into audit_logs(actor,actor_name,table_name,action,row_id,changes)
  values(auth.uid(),(select full_name from profiles where id=auth.uid()),tg_table_name,lower(tg_op),
    coalesce(n->>'id',o->>'id',n->>'registration_id',o->>'registration_id'),ch);
  return coalesce(new,old); end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','donors','camps','registrations','screenings','donations','blood_units','handovers','emergency_requests',
                           'tasks','camp_volunteers','sponsors','expenses','settings','message_templates','stock_thresholds'] loop
    execute format('create or replace trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_row()', t);
  end loop; end $$;

-- ---------- grants ----------
revoke execute on function audit_row(), guard_profile(), sync_profile_email(), handle_new_user(), donation_to_unit() from public, anon, authenticated;
revoke execute on function update_unit(uuid,text,blood_group,int,date,date,text), my_access() from public, anon;
grant execute on function update_unit(uuid,text,blood_group,int,date,date,text), my_access(), perm(text) to authenticated;
grant execute on function camp_slots(uuid) to anon, authenticated;

-- hardening (advisor)
alter function public.role_default_perms(app_role) set search_path = public;
revoke execute on function public.slot_is_full(uuid,text) from public, anon, authenticated;
