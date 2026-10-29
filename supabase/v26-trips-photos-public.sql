-- v26: club trips with collections and expenses; camp photos (Google Drive links) shown on the public pages;
-- the public camp page and impact page cover every camp type. Run once, after v25.

-- ---------- club trips ----------
create sequence if not exists club_trips_no_seq;
create table if not exists club_trips(
  id uuid primary key default gen_random_uuid(),
  trip_no int unique default nextval('club_trips_no_seq'),
  title text not null check (length(trim(title))>=2),
  destination text,
  start_date date not null,
  end_date date,
  purpose text,
  per_head numeric(12,2) check (per_head is null or per_head>=0),
  budget numeric(12,2) check (budget is null or budget>=0),
  club_share numeric(12,2) not null default 0 check (club_share>=0),
  status text not null default 'planned' check (status in ('planned','ongoing','completed','cancelled')),
  notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid,
  check (end_date is null or end_date>=start_date));
create table if not exists trip_people(
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references club_trips(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  name text not null check (length(trim(name))>=2),
  phone text,
  kind text not null default 'member' check (kind in ('member','family','guest')),
  share numeric(12,2) check (share is null or share>=0),
  paid numeric(12,2) not null default 0 check (paid>=0),
  paid_on date, mode text, notes text,
  created_at timestamptz not null default now());
create unique index if not exists trip_people_member on trip_people(trip_id,member_id) where member_id is not null;
create table if not exists trip_expenses(
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references club_trips(id) on delete cascade,
  spent_on date not null default current_date,
  category text not null default 'Other' check (category in ('Travel','Stay','Food','Tickets and entry','Guide','Shopping and gifts','Medical','Other')),
  description text,
  amount numeric(12,2) not null check (amount>0),
  paid_by text, mode text, reference text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now());
alter table club_trips enable row level security; alter table trip_people enable row level security; alter table trip_expenses enable row level security;
drop policy if exists "trips manage" on club_trips; drop policy if exists "trip people manage" on trip_people; drop policy if exists "trip expenses manage" on trip_expenses;
create policy "trips manage" on club_trips for all using (perm('funds') or perm('members')) with check (perm('funds') or perm('members'));
create policy "trip people manage" on trip_people for all using (perm('funds') or perm('members')) with check (perm('funds') or perm('members'));
create policy "trip expenses manage" on trip_expenses for all using (perm('funds') or perm('members')) with check (perm('funds') or perm('members'));
grant select, insert, update on club_trips to authenticated;
grant select, insert, update, delete on trip_people, trip_expenses to authenticated;
grant usage on sequence club_trips_no_seq to authenticated;
create or replace trigger audit_club_trips after insert or update or delete on club_trips for each row execute function audit_row();
create or replace trigger audit_trip_people after insert or update or delete on trip_people for each row execute function audit_row();
create or replace trigger audit_trip_expenses after insert or update or delete on trip_expenses for each row execute function audit_row();
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['club_trips','trip_people','trip_expenses'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=t) then execute format('alter publication supabase_realtime add table %I',t); end if;
    end loop; end if; end $$;

-- ---------- camp photos ----------
-- a Google Drive folder link (shared "Anyone with the link: Viewer"), or photo links, one per line
alter table camps add column if not exists photo_links text;

-- ---------- public: upcoming camps of every type, and recent camps with their numbers and photos ----------
create or replace function public_camps() returns jsonb language sql stable security definer set search_path=public as $$
  with c as (select c.*, case when c.camp_type='Blood donation' then (select count(*) from registrations r where r.camp_id=c.id)
                             else (select count(*) from camp_people p where p.camp_id=c.id) end as reg
             from camps c where c.deleted_at is null)
  select jsonb_build_object(
    'today',ist_today(),
    'upcoming',(select coalesce(jsonb_agg(x order by x->>'date'),'[]') from (select jsonb_build_object('id',id,'no',camp_no,'name',name,'type',camp_type,'type_other',camp_type_other,
        'date',camp_date,'start_time',start_time,'end_time',end_time,'venue',venue,'status',status,'about',about,'partner',partner,'cancer_types',cancer_types,
        'target',coalesce(target_donors,target_people),'registered',reg,
        'donated',(select count(*) from registrations r where r.camp_id=c.id and r.status='donated'),
        'online',(camp_type in ('Blood donation','Eye checking','Cancer awareness','Others')),'photos',photo_links) x
      from c where camp_date>=ist_today()-1 and status in ('planned','open','live') order by camp_date limit 8) s),
    'recent',(select coalesce(jsonb_agg(x order by x->>'date' desc),'[]') from (select jsonb_build_object('id',id,'no',camp_no,'name',name,'type',camp_type,'type_other',camp_type_other,
        'date',camp_date,'venue',venue,'partner',partner,'photos',photo_links,
        'donated',(select count(*) from registrations r where r.camp_id=c.id and r.status='donated'),
        'seen',(select count(*) from camp_people p where p.camp_id=c.id and p.status='attended'),
        'fed',(select coalesce(sum(f.people),0) from camp_food f where f.camp_id=c.id),
        'planted',(select coalesce(sum(s.count),0) from camp_saplings s where s.camp_id=c.id),
        'heard',(select coalesce(sum(x.attendees),0) from camp_sessions x where x.camp_id=c.id),
        'helped',beneficiaries) x
      from c where status in ('completed','closed') and camp_date<=ist_today() order by camp_date desc limit 12) s)) $$;
grant execute on function public_camps() to anon, authenticated;

-- public impact: camps held by type, and what each kind of camp achieved
create or replace function public_impact() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('club',(select club_name from settings where id=1),
    'units',(select count(*) from donations)+(select coalesce(sum(coalesce(units,1)),0) from donor_events where kind in ('outside_donation','emergency_donation')),
    'camp_units',(select count(*) from donations),
    'donors',(select count(*) from donors where deleted_at is null),
    'camps',(select count(*) from camps where deleted_at is null and status in ('completed','closed','live') and camp_type='Blood donation'),
    'all_camps',(select count(*) from camps where deleted_at is null and status in ('completed','closed','live')),
    'camps_by_type',(select coalesce(jsonb_object_agg(t,n),'{}') from (select camp_type t,count(*) n from camps where deleted_at is null and status in ('completed','closed','live') group by 1) x),
    'eye',(select count(*) from afterlife_cases where deleted_at is null and status in ('collected','handed over') and 'eye'=any(kinds)),
    'body',(select count(*) from afterlife_cases where deleted_at is null and status in ('collected','handed over') and 'body'=any(kinds)),
    'pledges',(select count(*) from pledges where deleted_at is null and status='active'),
    'projects',(select count(*) from projects where deleted_at is null and status='completed'),
    'helped',(select coalesce(sum(beneficiaries),0) from projects where deleted_at is null and status='completed')
            +(select coalesce(sum(beneficiaries),0) from camps where deleted_at is null and camp_type<>'Blood donation' and status in ('completed','closed','live')),
    'eye_screened',(select count(*) from camp_people p join camps c on c.id=p.camp_id where c.deleted_at is null and c.camp_type='Eye checking' and p.status='attended'),
    'spectacles',(select count(*) from camp_people p join camps c on c.id=p.camp_id where c.deleted_at is null and 'Spectacles given'=any(p.actions)),
    'eye_referred',(select count(*) from camp_people p join camps c on c.id=p.camp_id where c.deleted_at is null and c.camp_type='Eye checking' and coalesce(trim(p.referred_to),'')<>''),
    'cancer_screened',(select count(*) from camp_people p join camps c on c.id=p.camp_id where c.deleted_at is null and c.camp_type='Cancer awareness' and p.status='attended'),
    'cancer_heard',(select coalesce(sum(x.attendees),0) from camp_sessions x join camps c on c.id=x.camp_id where c.deleted_at is null),
    'meals',(select coalesce(sum(f.people),0) from camp_food f join camps c on c.id=f.camp_id where c.deleted_at is null),
    'food_places',(select count(*) from camp_food f join camps c on c.id=f.camp_id where c.deleted_at is null),
    'saplings',(select coalesce(sum(s.count),0) from camp_saplings s join camps c on c.id=s.camp_id where c.deleted_at is null),
    'saplings_alive',(select coalesce(sum(s.alive),0) from camp_saplings s join camps c on c.id=s.camp_id where c.deleted_at is null and s.alive is not null),
    'hours',(select coalesce(sum(hours),0) from project_hours where approved),
    'members',(select count(*) from members where deleted_at is null and status='active'),
    'by_group',(select jsonb_object_agg(g,n) from (select d.blood_group::text g,count(*) n from donations x join registrations r on r.id=x.registration_id join donors d on d.id=r.donor_id where d.blood_group is not null group by 1) s),
    'by_month',(select coalesce(jsonb_agg(jsonb_build_object('m',m,'n',n) order by m),'[]') from (select to_char(c.camp_date,'YYYY-MM') m,count(*) n from donations x join registrations r on r.id=x.registration_id join camps c on c.id=r.camp_id
      where c.camp_date>=(current_date-interval '12 months') group by 1) s),
    'next_camp',(select jsonb_build_object('id',id,'name',name,'date',camp_date,'venue',venue,'type',camp_type) from camps where deleted_at is null and status='open' and camp_date>=current_date order by camp_date limit 1)) $$;
grant execute on function public_impact() to anon, authenticated;

-- dashboard: trips too
create or replace function trip_numbers() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not (perm('funds') or perm('members')) then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'trips_next',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'destination',t.destination,'date',t.start_date,
        'people',(select count(*) from trip_people p where p.trip_id=t.id),'collected',(select coalesce(sum(paid),0) from trip_people p where p.trip_id=t.id),
        'spent',(select coalesce(sum(amount),0) from trip_expenses e where e.trip_id=t.id)) order by t.start_date),'[]')
      from club_trips t where t.deleted_at is null and t.status in ('planned','ongoing') ),
    'trips_year',(select count(*) from club_trips where deleted_at is null and status<>'cancelled' and start_date>=make_date(case when extract(month from ist_today())>=7 then extract(year from ist_today())::int else extract(year from ist_today())::int-1 end,7,1)));
end $$;
revoke execute on function trip_numbers() from public, anon;
grant execute on function trip_numbers() to authenticated;
