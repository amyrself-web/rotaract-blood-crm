-- Phase 2: run once in Supabase SQL Editor (after schema.sql)
create type blood_group as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-');
create table donors(
  id uuid primary key default gen_random_uuid(),
  full_name text not null, phone text not null unique, email text,
  blood_group blood_group, gender text, dob date, area text, last_donation date,
  consent boolean not null default false, consent_at timestamptz,
  source text default 'manual', created_at timestamptz default now());
create table camps(
  id uuid primary key default gen_random_uuid(),
  name text not null, camp_date date not null, start_time time, end_time time,
  venue text, target_donors int,
  status text not null default 'planned' check (status in ('planned','open','live','completed','closed')),
  created_at timestamptz default now());
create table registrations(
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references camps on delete cascade,
  donor_id uuid not null references donors on delete cascade,
  slot text,
  status text not null default 'registered' check (status in ('registered','checked_in','screened','donated','deferred','no_show')),
  created_at timestamptz default now(), unique(camp_id,donor_id));
alter table donors enable row level security;
alter table camps enable row level security;
alter table registrations enable row level security;
create policy "staff manage donors" on donors for all using (has_role(array['admin','coordinator']::app_role[])) with check (has_role(array['admin','coordinator']::app_role[]));
create policy "medical read donors" on donors for select using (has_role(array['medical']::app_role[]));
create policy "staff manage camps" on camps for all using (has_role(array['admin','coordinator']::app_role[])) with check (has_role(array['admin','coordinator']::app_role[]));
create policy "team read camps" on camps for select using (has_role(array['medical','volunteer']::app_role[]));
create policy "public read open camps" on camps for select to anon, authenticated using (status='open');
create policy "staff manage registrations" on registrations for all using (has_role(array['admin','coordinator']::app_role[])) with check (has_role(array['admin','coordinator']::app_role[]));
create policy "team read registrations" on registrations for select using (has_role(array['medical','volunteer']::app_role[]));
-- Public registration form calls this; the only way anonymous visitors can write data
create function register_for_camp(p_camp uuid,p_name text,p_phone text,p_group blood_group,p_dob date,p_area text,p_slot text,p_consent boolean)
returns text language plpgsql security definer set search_path=public as $$
declare d uuid; begin
  if not p_consent then raise exception 'Consent is required'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number'; end if;
  if p_dob is null or p_dob > current_date - interval '18 years' or p_dob < current_date - interval '66 years' then raise exception 'Donors must be 18 to 65 years old'; end if;
  if not exists(select 1 from camps where id=p_camp and status='open') then raise exception 'Registration for this camp is closed'; end if;
  insert into donors(full_name,phone,blood_group,dob,area,consent,consent_at,source)
  values(trim(p_name),p_phone,p_group,p_dob,nullif(trim(p_area),''),true,now(),'public_form')
  on conflict(phone) do update set consent=true, consent_at=coalesce(donors.consent_at,now()) returning id into d;
  insert into registrations(camp_id,donor_id,slot) values(p_camp,d,p_slot) on conflict do nothing;
  return 'ok'; end $$;
grant execute on function register_for_camp to anon, authenticated;
