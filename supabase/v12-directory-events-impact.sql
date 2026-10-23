-- v12: hospital and blood bank directory, club assets, club events with registration and passes, public impact numbers. Run once, after v11.

-- ---------- hospitals, blood banks, eye banks ----------
create table if not exists hospitals(
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name))>=3),
  kind text not null default 'Hospital' check (kind in ('Hospital','Blood bank','Eye bank','Medical college','Ambulance','Other')),
  city text, address text, phone text, phone2 text, contact_person text, email text,
  open_24x7 boolean not null default false, tie_up boolean not null default false,
  blood_groups_note text, notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);
alter table hospitals enable row level security;
create policy "hospitals read" on hospitals for select using (perm('emergency') or perm('stock') or perm('camps') or perm('afterlife') or perm('donors'));
create policy "hospitals manage" on hospitals for all using (perm('emergency') or perm('camps') or perm('afterlife')) with check (perm('emergency') or perm('camps') or perm('afterlife'));
grant select, insert, update on hospitals to authenticated;
create or replace trigger audit_hospitals after insert or update or delete on hospitals for each row execute function audit_row();

-- ---------- club assets: banners, standees, first aid box, sound system ----------
create sequence if not exists club_assets_no_seq;
create table if not exists club_assets(
  id uuid primary key default gen_random_uuid(),
  asset_no int unique default nextval('club_assets_no_seq'),
  name text not null check (length(trim(name))>=2),
  category text not null default 'Other' check (category in ('Banners and printing','Medical supplies','Furniture and setup','Electronics','Stationery','Uniform','Other')),
  qty int not null default 1 check (qty>=0), condition text not null default 'Good' check (condition in ('New','Good','Needs repair','Lost','Disposed')),
  kept_with text, kept_at text, purchased_on date, value numeric(12,2) check (value is null or value>=0), notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz default now(), deleted_at timestamptz, deleted_by uuid);
alter table club_assets enable row level security;
create policy "assets manage" on club_assets for all using (perm('planning') or perm('funds')) with check (perm('planning') or perm('funds'));
grant select, insert, update on club_assets to authenticated;
create or replace trigger audit_club_assets after insert or update or delete on club_assets for each row execute function audit_row();

-- ---------- club events (installation, fundraiser, workshop) with registration, passes and check-in ----------
create sequence if not exists events_no_seq;
create table if not exists events(
  id uuid primary key default gen_random_uuid(),
  event_no int unique default nextval('events_no_seq'),
  title text not null check (length(trim(title))>=3),
  kind text not null default 'Fellowship' check (kind in ('Installation','Fundraiser','Fellowship','Workshop','Awareness','Sports','Other')),
  event_date date not null, start_time time, end_time time, venue text, capacity int check (capacity is null or capacity>0),
  open_registration boolean not null default false, fee numeric(10,2), description text,
  status text not null default 'planned' check (status in ('planned','open','done','cancelled')),
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);
alter table events enable row level security;
create policy "events manage" on events for all using (perm('meetings') or perm('members')) with check (perm('meetings') or perm('members'));
create policy "events members read" on events for select using (deleted_at is null and (my_member()).id is not null);
grant select, insert, update on events to authenticated;
create or replace trigger audit_events after insert or update or delete on events for each row execute function audit_row();

create table if not exists event_people(
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  pass_no int not null,
  name text not null check (length(trim(name))>=2), phone text, email text, organisation text,
  role text not null default 'Guest' check (role in ('Guest','Member','Volunteer','Speaker','Chief guest','Media','Organiser','Participant')),
  member_id uuid references members on delete set null,
  checked_in_at timestamptz, self_registered boolean not null default false, notes text,
  created_at timestamptz not null default now(), unique(event_id, pass_no));
alter table event_people enable row level security;
create policy "event people manage" on event_people for all using (perm('meetings') or perm('members')) with check (perm('meetings') or perm('members'));
grant select, insert, update, delete on event_people to authenticated;

create or replace function event_people_no() returns trigger language plpgsql set search_path=public as $$
begin
  if length(trim(coalesce(new.name,'')))<2 then raise exception 'Enter the name'; end if;
  if new.phone is not null and new.phone<>'' and new.phone !~ '^[6-9][0-9]{9}$' then raise exception 'Mobile number must be 10 digits'; end if;
  if tg_op='INSERT' and new.pass_no is null then
    perform pg_advisory_xact_lock(hashtext(new.event_id::text));
    select coalesce(max(pass_no),0)+1 into new.pass_no from event_people where event_id=new.event_id; end if;
  return new; end $$;
create or replace trigger event_people_no before insert or update on event_people for each row execute function event_people_no();

-- public page: details of an event that is open for registration
create or replace function event_public(p_event uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',e.id,'title',e.title,'kind',e.kind,'date',e.event_date,'start',e.start_time,'end',e.end_time,'venue',e.venue,'fee',e.fee,'description',e.description,
    'open',e.open_registration and e.status in ('planned','open') and e.event_date>=(now() at time zone 'Asia/Kolkata')::date,
    'full',e.capacity is not null and (select count(*) from event_people p where p.event_id=e.id)>=e.capacity,
    'club',(select club_name from settings where id=1))
  from events e where e.id=p_event and e.deleted_at is null $$;

create or replace function register_event(p_event uuid, p_name text, p_phone text, p_org text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e events; ph text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),10); r event_people; begin
  select * into e from events where id=p_event and deleted_at is null;
  if e.id is null or not e.open_registration or e.status not in ('planned','open') or e.event_date<(now() at time zone 'Asia/Kolkata')::date then raise exception 'Registration for this event is closed'; end if;
  if ph !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a 10-digit mobile number'; end if;
  select * into r from event_people where event_id=p_event and phone=ph;
  if r.id is not null then return jsonb_build_object('pass_no',r.pass_no,'name',r.name,'already',true); end if;
  if e.capacity is not null and (select count(*) from event_people where event_id=p_event)>=e.capacity then raise exception 'Sorry, this event is full'; end if;
  insert into event_people(event_id,name,phone,organisation,role,self_registered,member_id)
    values(p_event,trim(p_name),ph,nullif(trim(coalesce(p_org,'')),''),'Participant',true,(select id from members where phone=ph and deleted_at is null limit 1)) returning * into r;
  return jsonb_build_object('pass_no',r.pass_no,'name',r.name,'already',false); end $$;
grant execute on function event_public(uuid), register_event(uuid,text,text,text) to anon, authenticated;
revoke execute on function event_people_no() from public, anon, authenticated;

-- ---------- public impact numbers (no names) ----------
create or replace function public_impact() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('club',(select club_name from settings where id=1),
    'units',(select count(*) from donations)+(select coalesce(sum(coalesce(units,1)),0) from donor_events where kind in ('outside_donation','emergency_donation')),
    'camp_units',(select count(*) from donations),
    'donors',(select count(*) from donors where deleted_at is null),
    'camps',(select count(*) from camps where deleted_at is null and status in ('completed','closed','live')),
    'eye',(select count(*) from afterlife_cases where deleted_at is null and status in ('collected','handed over') and 'eye'=any(kinds)),
    'body',(select count(*) from afterlife_cases where deleted_at is null and status in ('collected','handed over') and 'body'=any(kinds)),
    'pledges',(select count(*) from pledges where deleted_at is null and status='active'),
    'projects',(select count(*) from projects where deleted_at is null and status='completed'),
    'helped',(select coalesce(sum(beneficiaries),0) from projects where deleted_at is null and status='completed'),
    'hours',(select coalesce(sum(hours),0) from project_hours where approved),
    'members',(select count(*) from members where deleted_at is null and status='active'),
    'by_group',(select jsonb_object_agg(g,n) from (select d.blood_group::text g,count(*) n from donations x join registrations r on r.id=x.registration_id join donors d on d.id=r.donor_id where d.blood_group is not null group by 1) s),
    'by_month',(select coalesce(jsonb_agg(jsonb_build_object('m',m,'n',n) order by m),'[]') from (select to_char(c.camp_date,'YYYY-MM') m,count(*) n from donations x join registrations r on r.id=x.registration_id join camps c on c.id=r.camp_id
      where c.camp_date>=(current_date-interval '12 months') group by 1) s),
    'next_camp',(select jsonb_build_object('id',id,'name',name,'date',camp_date,'venue',venue) from camps where deleted_at is null and status='open' and camp_date>=current_date order by camp_date limit 1)) $$;
grant execute on function public_impact() to anon, authenticated;

-- ---------- donor milestones ----------
create or replace function donor_leaderboard(p_limit int default 10) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not perm('donors') then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select d.id,d.full_name as name,d.donor_no,d.blood_group,
      (select count(*) from donations n join registrations r on r.id=n.registration_id where r.donor_id=d.id)+(select coalesce(sum(coalesce(units,1)),0) from donor_events e where e.donor_id=d.id and e.kind in ('outside_donation','emergency_donation')) as total
    from donors d where d.deleted_at is null order by total desc, d.donor_no limit p_limit) x where x.total>0),'[]'); end $$;
grant execute on function donor_leaderboard(int) to authenticated; revoke execute on function donor_leaderboard(int) from public, anon;

do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['hospitals','club_assets','events','event_people'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=t) then execute format('alter publication supabase_realtime add table %I',t); end if;
    end loop; end if; end $$;

-- trigger and helper functions are not for direct calls
revoke execute on function log_consent() from authenticated;
revoke execute on function wa_next_slot(timestamptz), wa_template(text) from authenticated;
