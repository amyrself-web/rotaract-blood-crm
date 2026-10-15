-- Phase 3: camp-day operations. Run once in Supabase SQL Editor (after phase2.sql)
create table screenings(
  registration_id uuid primary key references registrations on delete cascade,
  hb numeric(4,1), systolic int, diastolic int, weight_kg numeric(5,1), pulse int,
  decision text not null check (decision in ('eligible','deferred')),
  defer_reason text, defer_until date, notes text,
  screened_by uuid references auth.users, created_at timestamptz default now());
create table donations(
  registration_id uuid primary key references registrations on delete cascade,
  bag_number text not null unique,
  volume_ml int not null default 350 check (volume_ml between 100 and 500),
  reaction text, donated_by uuid references auth.users, created_at timestamptz default now());
alter table screenings enable row level security;
alter table donations enable row level security;
-- Health data: only Super Admin and Medical Staff
create policy "medical manage screenings" on screenings for all using (has_role(array['admin','medical']::app_role[])) with check (has_role(array['admin','medical']::app_role[]));
create policy "medical manage donations" on donations for all using (has_role(array['admin','medical']::app_role[])) with check (has_role(array['admin','medical']::app_role[]));
create policy "coordinator read donations" on donations for select using (has_role(array['coordinator']::app_role[]));

-- Live worklist for one camp. Volunteers see names but only the last 4 digits of the phone.
create function camp_worklist(p_camp uuid)
returns table(reg_id uuid, slot text, status text, full_name text, phone text, blood_group blood_group, gender text, last_donation date, bag_number text, volume_ml int)
language plpgsql security definer set search_path=public as $$
begin
  if not has_role(array['admin','coordinator','medical','volunteer']::app_role[]) then raise exception 'Not allowed'; end if;
  return query
    select r.id, r.slot, r.status, d.full_name,
      case when has_role(array['admin','coordinator','medical']::app_role[]) then d.phone else 'XXXXXX'||right(d.phone,4) end,
      d.blood_group, d.gender, d.last_donation, n.bag_number, n.volume_ml
    from registrations r join donors d on d.id=r.donor_id left join donations n on n.registration_id=r.id
    where r.camp_id=p_camp order by r.slot nulls last, d.full_name;
end $$;

create function set_reg_status(p_reg uuid, p_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not has_role(array['admin','coordinator','medical','volunteer']::app_role[]) then raise exception 'Not allowed'; end if;
  update registrations set status=p_status where id=p_reg and (
    (p_status='checked_in' and status in ('registered','no_show')) or (p_status='no_show' and status='registered'));
  if not found then raise exception 'This donor cannot be moved to that step'; end if;
end $$;

create function save_screening(p_reg uuid,p_hb numeric,p_sys int,p_dia int,p_wt numeric,p_pulse int,p_decision text,p_reason text,p_until date,p_notes text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not has_role(array['admin','medical']::app_role[]) then raise exception 'Only medical staff can screen donors'; end if;
  if p_decision not in ('eligible','deferred') then raise exception 'Invalid decision'; end if;
  if p_decision='deferred' and coalesce(trim(p_reason),'')='' then raise exception 'Give a reason for deferral'; end if;
  if not exists(select 1 from registrations where id=p_reg and status in ('checked_in','screened','deferred')) then raise exception 'Donor must be checked in first'; end if;
  insert into screenings(registration_id,hb,systolic,diastolic,weight_kg,pulse,decision,defer_reason,defer_until,notes,screened_by)
  values(p_reg,p_hb,p_sys,p_dia,p_wt,p_pulse,p_decision,p_reason,p_until,p_notes,auth.uid())
  on conflict (registration_id) do update set hb=excluded.hb,systolic=excluded.systolic,diastolic=excluded.diastolic,weight_kg=excluded.weight_kg,
    pulse=excluded.pulse,decision=excluded.decision,defer_reason=excluded.defer_reason,defer_until=excluded.defer_until,notes=excluded.notes,screened_by=excluded.screened_by;
  update registrations set status=case when p_decision='eligible' then 'screened' else 'deferred' end where id=p_reg;
end $$;

create function record_donation(p_reg uuid, p_bag text, p_vol int, p_reaction text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not has_role(array['admin','medical']::app_role[]) then raise exception 'Only medical staff can record donations'; end if;
  if coalesce(trim(p_bag),'')='' then raise exception 'Enter the bag number'; end if;
  if not exists(select 1 from registrations where id=p_reg and status='screened') then raise exception 'Donor must be screened and cleared first'; end if;
  begin
    insert into donations(registration_id,bag_number,volume_ml,reaction,donated_by) values(p_reg,trim(p_bag),coalesce(p_vol,350),nullif(trim(p_reaction),''),auth.uid());
  exception when unique_violation then raise exception 'This bag number is already used';
  end;
  update registrations set status='donated' where id=p_reg;
  update donors set last_donation=current_date where id=(select donor_id from registrations where id=p_reg);
end $$;

create function walk_in(p_camp uuid,p_name text,p_phone text,p_group blood_group,p_dob date,p_area text,p_consent boolean) returns text
language plpgsql security definer set search_path=public as $$
declare d uuid; begin
  if not has_role(array['admin','coordinator','volunteer']::app_role[]) then raise exception 'Not allowed'; end if;
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
grant execute on function camp_worklist, set_reg_status, save_screening, record_donation, walk_in to authenticated;
