-- Phase 6: blood stock, handovers, emergency requests. Run once (after phase5.sql)
create table handovers(
  id uuid primary key default gen_random_uuid(),
  bank_name text not null, handed_on date not null default current_date, notes text,
  created_by uuid references auth.users default auth.uid(), created_at timestamptz default now());
create table blood_units(
  id uuid primary key default gen_random_uuid(),
  bag_number text not null unique, blood_group blood_group, volume_ml int,
  collected_on date not null default current_date,
  expiry_date date, -- default 35 days for whole blood; confirm with the partner blood bank
  camp_id uuid references camps on delete set null,
  donation_reg uuid references registrations on delete set null,
  source text not null default 'camp',
  status text not null default 'collected' check (status in ('collected','in_transit','testing','available','issued','discarded')),
  handover_id uuid references handovers on delete set null,
  note text, updated_at timestamptz default now());
create table stock_thresholds(blood_group blood_group primary key, min_units int not null default 5);
insert into stock_thresholds(blood_group) select g from unnest(enum_range(null::blood_group)) g;
create table emergency_requests(
  id uuid primary key default gen_random_uuid(),
  patient_ref text, blood_group blood_group not null, units_needed int not null default 1 check (units_needed>0),
  hospital text not null, contact_name text, contact_phone text, notes text,
  status text not null default 'open' check (status in ('open','fulfilled','cancelled')),
  created_by uuid references auth.users default auth.uid(), created_at timestamptz default now());
alter table handovers enable row level security;
alter table blood_units enable row level security;
alter table stock_thresholds enable row level security;
alter table emergency_requests enable row level security;
create policy "staff read units" on blood_units for select using (has_role(array['admin','coordinator','medical']::app_role[]));
create policy "staff read handovers" on handovers for select using (has_role(array['admin','coordinator','medical']::app_role[]));
create policy "staff read thresholds" on stock_thresholds for select using (has_role(array['admin','coordinator','medical']::app_role[]));
create policy "admin write thresholds" on stock_thresholds for all using (has_role(array['admin']::app_role[])) with check (has_role(array['admin']::app_role[]));
create policy "staff manage requests" on emergency_requests for all using (has_role(array['admin','coordinator']::app_role[])) with check (has_role(array['admin','coordinator']::app_role[]));
create policy "medical read requests" on emergency_requests for select using (has_role(array['medical']::app_role[]));

-- Every recorded donation becomes a stock unit automatically
create function donation_to_unit() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into blood_units(bag_number,blood_group,volume_ml,collected_on,camp_id,donation_reg,expiry_date)
  select new.bag_number,d.blood_group,new.volume_ml,current_date,r.camp_id,new.registration_id,current_date+35
  from registrations r join donors d on d.id=r.donor_id where r.id=new.registration_id
  on conflict (bag_number) do nothing;
  return new; end $$;
create trigger donation_unit after insert on donations for each row execute function donation_to_unit();
insert into blood_units(bag_number,blood_group,volume_ml,collected_on,camp_id,donation_reg,expiry_date)
select n.bag_number,d.blood_group,n.volume_ml,n.created_at::date,r.camp_id,n.registration_id,n.created_at::date+35
from donations n join registrations r on r.id=n.registration_id join donors d on d.id=r.donor_id on conflict (bag_number) do nothing;

create function set_unit_status(p_unit uuid,p_status text,p_note text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not has_role(array['admin','medical']::app_role[]) then raise exception 'Only medical staff can change stock'; end if;
  if p_status not in ('collected','in_transit','testing','available','issued','discarded') then raise exception 'Invalid status'; end if;
  update blood_units set status=p_status, note=coalesce(nullif(trim(p_note),''),note), updated_at=now() where id=p_unit;
  if not found then raise exception 'Unit not found'; end if;
end $$;

create function add_unit(p_bag text,p_group blood_group,p_vol int,p_collected date,p_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not has_role(array['admin','medical']::app_role[]) then raise exception 'Only medical staff can add stock'; end if;
  if coalesce(trim(p_bag),'')='' then raise exception 'Enter the bag number'; end if;
  begin
    insert into blood_units(bag_number,blood_group,volume_ml,collected_on,expiry_date,source,status)
    values(trim(p_bag),p_group,coalesce(p_vol,350),coalesce(p_collected,current_date),coalesce(p_collected,current_date)+35,'manual',coalesce(p_status,'available'));
  exception when unique_violation then raise exception 'This bag number already exists';
  end;
end $$;

create function handover_units(p_units uuid[],p_bank text,p_notes text) returns void
language plpgsql security definer set search_path=public as $$
declare h uuid; n int; begin
  if not has_role(array['admin','coordinator','medical']::app_role[]) then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_bank),'')='' then raise exception 'Enter the blood bank name'; end if;
  insert into handovers(bank_name,notes) values(trim(p_bank),nullif(trim(p_notes),'')) returning id into h;
  update blood_units set status='in_transit', handover_id=h, updated_at=now() where id=any(p_units) and status='collected';
  get diagnostics n = row_count;
  if n=0 then raise exception 'No collected units were selected'; end if;
end $$;
grant execute on function set_unit_status, add_unit, handover_units to authenticated;
