-- v20: every camp type gets its own records and camp-day screen.
-- Eye checking / Cancer awareness / Others: people with screening results, referrals and follow-up (camp_people)
-- Cancer awareness: talks (camp_sessions)    Food donation: distribution points (camp_food)
-- Plantation: sapling batches with survival checks (camp_saplings, camp_sapling_checks)
-- Public online registration for people camps, a type-wise camp summary, and "people helped" counted by itself. Run once, after v19.

alter table camps add column if not exists partner text;            -- hospital / NGO / school working with the club
alter table camps add column if not exists partner_contact text;
alter table camps add column if not exists doctors text;
alter table camps add column if not exists target_people int;       -- people to serve / saplings to plant
alter table camps add column if not exists details jsonb not null default '{}';
alter table camps add column if not exists closed_at timestamptz;
alter table camps drop constraint if exists camps_target_people_ok;
alter table camps add constraint camps_target_people_ok check (target_people is null or target_people>0);

create or replace function camp_can_work(p_camp uuid) returns boolean language sql stable security definer set search_path=public as $$
  select perm('camps') or perm('campday') or perm('planning') or perm('screening') $$;

-- ---------- people at eye / cancer / other camps ----------
create table if not exists camp_people(
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references camps on delete cascade,
  token_no int not null,
  full_name text not null check (length(trim(full_name))>=2),
  age int check (age is null or age between 0 and 120),
  gender text check (gender is null or gender in ('Male','Female','Other')),
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  area text, address text,
  source text not null default 'desk' check (source in ('desk','online','import')),
  status text not null default 'registered' check (status in ('registered','attended','no_show')),
  screenings text[] not null default '{}',                 -- what was checked: Vision, Oral, Breast ...
  findings text[] not null default '{}',                   -- eye: Normal, Refractive error, Cataract ...
  actions text[] not null default '{}',                    -- eye: Spectacles given, Surgery referral ...
  result text check (result is null or result in ('normal','needs_care','suspicious')),
  vision_right text, vision_left text, power text,
  referred_to text,
  follow_up text not null default 'none' check (follow_up in ('none','pending','done','not_reachable','declined')),
  follow_up_on date, follow_up_note text,
  consent boolean not null default false,
  notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(camp_id, token_no));
create unique index if not exists camp_people_phone on camp_people(camp_id, phone) where phone is not null;
create index if not exists camp_people_follow on camp_people(follow_up) where follow_up='pending';

create or replace function camp_people_before() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' and new.token_no is null then
    perform pg_advisory_xact_lock(hashtext('camp_people'||new.camp_id::text));
    select coalesce(max(token_no),0)+1 into new.token_no from camp_people where camp_id=new.camp_id; end if;
  new.full_name := trim(new.full_name);
  if new.phone is not null then new.phone := nullif(right(regexp_replace(new.phone,'\D','','g'),10),''); end if;
  if (tg_op='INSERT' or new.referred_to is distinct from old.referred_to) and coalesce(trim(new.referred_to),'')<>'' and new.follow_up='none' then new.follow_up := 'pending'; end if;
  if new.status='registered' and (cardinality(new.screenings)>0 or cardinality(new.findings)>0 or new.result is not null) then new.status := 'attended'; end if;
  new.updated_at := now();
  return new; end $$;
drop trigger if exists camp_people_before on camp_people;
create trigger camp_people_before before insert or update on camp_people for each row execute function camp_people_before();
alter table camp_people alter column token_no drop not null;

-- ---------- awareness talks ----------
create table if not exists camp_sessions(
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references camps on delete cascade,
  topic text not null check (length(trim(topic))>=2), speaker text, held_at time,
  attendees int check (attendees is null or attendees>=0), materials int check (materials is null or materials>=0),
  notes text, created_at timestamptz not null default now());

-- ---------- food distribution ----------
create table if not exists camp_food(
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references camps on delete cascade,
  place text not null check (length(trim(place))>=2),
  group_type text check (group_type is null or group_type in ('Orphanage','Old age home','Hospital','Street / roadside','Slum / colony','School','Special home','Other')),
  people int not null default 0 check (people>=0), packets int check (packets is null or packets>=0),
  items text, served_at time, served_by text, notes text, created_at timestamptz not null default now());

-- ---------- plantation ----------
create table if not exists camp_saplings(
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references camps on delete cascade,
  species text not null check (length(trim(species))>=2),
  count int not null check (count>0),
  place text, landmark text, lat numeric(9,6), lng numeric(9,6),
  planted_by text, guardian text, guardian_phone text check (guardian_phone is null or guardian_phone ~ '^[6-9][0-9]{9}$'),
  alive int check (alive is null or alive>=0), last_check date,
  notes text, created_at timestamptz not null default now(),
  check (alive is null or alive<=count));
create table if not exists camp_sapling_checks(
  id uuid primary key default gen_random_uuid(),
  sapling_id uuid not null references camp_saplings on delete cascade,
  checked_on date not null default current_date, alive int not null check (alive>=0), notes text,
  checked_by uuid default auth.uid(), created_at timestamptz not null default now());
-- the latest check is the batch's current count
create or replace function sapling_check_after() returns trigger language plpgsql security definer set search_path=public as $$
declare s uuid := coalesce(new.sapling_id,old.sapling_id); begin
  update camp_saplings b set (alive,last_check) = (select x.alive, x.checked_on from camp_sapling_checks x where x.sapling_id=s order by x.checked_on desc, x.created_at desc limit 1) where b.id=s;
  return null; end $$;
drop trigger if exists sapling_check_after on camp_sapling_checks;
create trigger sapling_check_after after insert or update or delete on camp_sapling_checks for each row execute function sapling_check_after();
create or replace function sapling_check_ok() returns trigger language plpgsql set search_path=public as $$
begin if new.alive > (select count from camp_saplings where id=new.sapling_id) then raise exception 'Alive cannot be more than the saplings planted'; end if; return new; end $$;
drop trigger if exists sapling_check_ok on camp_sapling_checks;
create trigger sapling_check_ok before insert or update on camp_sapling_checks for each row execute function sapling_check_ok();

-- ---------- access, audit, live updates ----------
do $$ declare t text; begin
  foreach t in array array['camp_people','camp_sessions','camp_food','camp_saplings','camp_sapling_checks'] loop
    execute format('alter table %I enable row level security',t);
    execute format('drop policy if exists "camp work" on %I',t);
    execute format('create policy "camp work" on %I for all using (perm(''camps'') or perm(''campday'') or perm(''planning'') or perm(''screening'')) with check (perm(''camps'') or perm(''campday'') or perm(''planning'') or perm(''screening''))',t);
    execute format('grant select, insert, update, delete on %I to authenticated',t);
    execute format('create or replace trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_row()',t);
    execute format('drop trigger if exists pulse_%1$s on %1$I',t);
    execute format('create trigger pulse_%1$s after insert or update or delete on %1$I for each statement execute function bump_pulse()',t);
    if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=t) then
      execute format('alter publication supabase_realtime add table %I',t); end if;
  end loop; end $$;

-- ---------- "people helped" counts itself ----------
create or replace function camp_people_count(p_camp uuid) returns int language sql stable security definer set search_path=public as $$
  select case c.camp_type
    when 'Food donation' then (select sum(people)::int from camp_food where camp_id=c.id)
    when 'Environment (plantation)' then (select sum(count)::int from camp_saplings where camp_id=c.id)
    when 'Blood donation' then null
    else nullif(greatest((select count(*) from camp_people where camp_id=c.id and status<>'no_show'),(select coalesce(sum(attendees),0) from camp_sessions where camp_id=c.id))::int,0) end
  from camps c where c.id=p_camp $$;
create or replace function camp_people_sync() returns trigger language plpgsql security definer set search_path=public as $$
declare cid uuid; n int; begin
  if tg_table_name='camp_sapling_checks' then return null; end if;
  cid := coalesce(new.camp_id, old.camp_id);
  n := camp_people_count(cid);
  if n is not null then perform set_config('app.reverting','1',true); update camps set beneficiaries=n where id=cid and beneficiaries is distinct from n; perform set_config('app.reverting','',true); end if;
  return null; end $$;
do $$ declare t text; begin
  foreach t in array array['camp_people','camp_sessions','camp_food','camp_saplings'] loop
    execute format('drop trigger if exists people_sync on %I',t);
    execute format('create trigger people_sync after insert or update or delete on %I for each row execute function camp_people_sync()',t);
  end loop; end $$;

-- ---------- online registration for eye / cancer / other camps ----------
create or replace function camp_public(p_camp uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',c.id,'name',c.name,'camp_type',c.camp_type,'camp_type_other',c.camp_type_other,'cancer_types',c.cancer_types,'camp_date',c.camp_date,
    'start_time',c.start_time,'end_time',c.end_time,'venue',c.venue,'status',c.status,'about',c.about,'partner',c.partner,
    'registered',(select count(*) from camp_people p where p.camp_id=c.id))
  from camps c where c.id=p_camp and c.deleted_at is null $$;
grant execute on function camp_public(uuid) to anon, authenticated;

create or replace function register_camp_person(p_camp uuid, p_name text, p_phone text, p_age int, p_gender text, p_area text, p_consent boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c camps; ph text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),10); r camp_people; begin
  select * into c from camps where id=p_camp and deleted_at is null;
  if c.id is null or c.camp_type='Blood donation' or c.camp_type='Food donation' or c.camp_type='Environment (plantation)' then raise exception 'This camp does not take online registration'; end if;
  if c.status<>'open' then raise exception 'Registration for this camp is not open. Please check with the club.'; end if;
  if c.camp_date < ist_today() then raise exception 'This camp is over'; end if;
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'Enter your full name'; end if;
  if ph !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number'; end if;
  if not coalesce(p_consent,false) then raise exception 'Please agree to be contacted about this camp'; end if;
  select * into r from camp_people where camp_id=p_camp and phone=ph;
  if r.id is not null then return jsonb_build_object('token',r.token_no,'already',true); end if;
  insert into camp_people(camp_id,full_name,phone,age,gender,area,source,consent) values(p_camp,p_name,ph,p_age,nullif(p_gender,''),nullif(trim(p_area),''),'online',true) returning * into r;
  return jsonb_build_object('token',r.token_no,'already',false); end $$;
grant execute on function register_camp_person(uuid,text,text,int,text,text,boolean) to anon, authenticated;

-- ---------- a camp in numbers (report, posters, camp day) ----------
create or replace function camp_summary(p_camp uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare c camps; out jsonb; begin
  if not (camp_can_work(p_camp) or perm('reports') or perm('messages')) then raise exception 'Not allowed'; end if;
  select * into c from camps where id=p_camp;
  if c.id is null then raise exception 'Camp not found'; end if;
  out := jsonb_build_object('camp',to_jsonb(c),
    'team',jsonb_build_object('members_present',(select count(*) from camp_attendance where camp_id=c.id and status in ('present','late')),
      'members_leave',(select count(*) from camp_attendance where camp_id=c.id and status='leave'),
      'volunteers',(select count(*) from camp_volunteers where camp_id=c.id),'volunteers_present',(select count(*) from camp_volunteers where camp_id=c.id and attended)),
    'money',jsonb_build_object('sponsors',(select coalesce(sum(amount),0) from sponsors where camp_id=c.id and received),'expenses',(select coalesce(sum(amount),0) from expenses where camp_id=c.id),'budget',c.budget));
  if c.camp_type='Blood donation' then
    out := out||jsonb_build_object('blood',jsonb_build_object('registered',(select count(*) from registrations where camp_id=c.id),
      'arrived',(select count(*) from registrations where camp_id=c.id and status not in ('registered','no_show')),
      'donated',(select count(*) from registrations where camp_id=c.id and status='donated'),'deferred',(select count(*) from registrations where camp_id=c.id and status='deferred'),
      'no_show',(select count(*) from registrations where camp_id=c.id and status='no_show'),
      'litres',(select round(coalesce(sum(n.volume_ml),0)/1000.0,1) from donations n join registrations r on r.id=n.registration_id where r.camp_id=c.id)));
  elsif c.camp_type='Food donation' then
    out := out||jsonb_build_object('food',jsonb_build_object('points',(select count(*) from camp_food where camp_id=c.id),'people',(select coalesce(sum(people),0) from camp_food where camp_id=c.id),
      'packets',(select coalesce(sum(packets),0) from camp_food where camp_id=c.id),
      'by_group',(select coalesce(jsonb_object_agg(g,n),'{}') from (select coalesce(group_type,'Other') g,sum(people) n from camp_food where camp_id=c.id group by 1) x),
      'list',(select coalesce(jsonb_agg(to_jsonb(f) order by f.served_at nulls last,f.created_at),'[]') from camp_food f where f.camp_id=c.id)));
  elsif c.camp_type='Environment (plantation)' then
    out := out||jsonb_build_object('plants',jsonb_build_object('batches',(select count(*) from camp_saplings where camp_id=c.id),'planted',(select coalesce(sum(count),0) from camp_saplings where camp_id=c.id),
      'checked',(select coalesce(sum(count),0) from camp_saplings where camp_id=c.id and alive is not null),'alive',(select coalesce(sum(alive),0) from camp_saplings where camp_id=c.id and alive is not null),
      'by_species',(select coalesce(jsonb_object_agg(s,n),'{}') from (select species s,sum(count) n from camp_saplings where camp_id=c.id group by 1) x),
      'list',(select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at),'[]') from camp_saplings s where s.camp_id=c.id)));
  else
    out := out||jsonb_build_object('people',jsonb_build_object('registered',(select count(*) from camp_people where camp_id=c.id),
      'online',(select count(*) from camp_people where camp_id=c.id and source='online'),
      'attended',(select count(*) from camp_people where camp_id=c.id and status='attended'),'no_show',(select count(*) from camp_people where camp_id=c.id and status='no_show'),
      'normal',(select count(*) from camp_people where camp_id=c.id and result='normal'),'needs_care',(select count(*) from camp_people where camp_id=c.id and result='needs_care'),
      'suspicious',(select count(*) from camp_people where camp_id=c.id and result='suspicious'),
      'referred',(select count(*) from camp_people where camp_id=c.id and coalesce(trim(referred_to),'')<>''),
      'follow_pending',(select count(*) from camp_people where camp_id=c.id and follow_up='pending'),'follow_done',(select count(*) from camp_people where camp_id=c.id and follow_up='done'),
      'male',(select count(*) from camp_people where camp_id=c.id and gender='Male'),'female',(select count(*) from camp_people where camp_id=c.id and gender='Female'),
      'children',(select count(*) from camp_people where camp_id=c.id and age<18),'seniors',(select count(*) from camp_people where camp_id=c.id and age>=60),
      'findings',(select coalesce(jsonb_object_agg(k,n),'{}') from (select unnest(findings) k,count(*) n from camp_people where camp_id=c.id group by 1) x),
      'actions',(select coalesce(jsonb_object_agg(k,n),'{}') from (select unnest(actions) k,count(*) n from camp_people where camp_id=c.id group by 1) x),
      'screenings',(select coalesce(jsonb_object_agg(k,n),'{}') from (select unnest(screenings) k,count(*) n from camp_people where camp_id=c.id group by 1) x)),
      'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.held_at nulls last,s.created_at),'[]') from camp_sessions s where s.camp_id=c.id));
  end if;
  return out; end $$;
grant execute on function camp_summary(uuid) to authenticated; revoke execute on function camp_summary(uuid) from public, anon;

-- ---------- end of the day ----------
-- marks everyone who never came as no-show and the camp as completed; the next-day thank-you and certificates follow as usual
create or replace function close_camp_day(p_camp uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare c camps; n int := 0; begin
  if not (perm('camps') or perm('campday')) then raise exception 'Not allowed'; end if;
  select * into c from camps where id=p_camp and deleted_at is null;
  if c.id is null then raise exception 'Camp not found'; end if;
  if c.camp_type='Blood donation' then update registrations set status='no_show' where camp_id=c.id and status='registered'; get diagnostics n=row_count;
  else update camp_people set status='no_show' where camp_id=c.id and status='registered'; get diagnostics n=row_count; end if;
  update camps set status='completed', closed_at=now() where id=c.id;
  return camp_summary(c.id)||jsonb_build_object('marked_no_show',n); end $$;
grant execute on function close_camp_day(uuid) to authenticated; revoke execute on function close_camp_day(uuid) from public, anon;

-- ---------- public impact: all camp types ----------
create or replace function public_impact() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('club',(select club_name from settings where id=1),
    'units',(select count(*) from donations)+(select coalesce(sum(coalesce(units,1)),0) from donor_events where kind in ('outside_donation','emergency_donation')),
    'camp_units',(select count(*) from donations),
    'donors',(select count(*) from donors where deleted_at is null),
    'camps',(select count(*) from camps where deleted_at is null and status in ('completed','closed','live') and camp_type='Blood donation'),
    'all_camps',(select count(*) from camps where deleted_at is null and status in ('completed','closed','live')),
    'eye',(select count(*) from afterlife_cases where deleted_at is null and status in ('collected','handed over') and 'eye'=any(kinds)),
    'body',(select count(*) from afterlife_cases where deleted_at is null and status in ('collected','handed over') and 'body'=any(kinds)),
    'pledges',(select count(*) from pledges where deleted_at is null and status='active'),
    'projects',(select count(*) from projects where deleted_at is null and status='completed'),
    'helped',(select coalesce(sum(beneficiaries),0) from projects where deleted_at is null and status='completed')
            +(select coalesce(sum(beneficiaries),0) from camps where deleted_at is null and camp_type<>'Blood donation' and status in ('completed','closed','live')),
    'eye_screened',(select count(*) from camp_people p join camps c on c.id=p.camp_id where c.deleted_at is null and c.camp_type='Eye checking' and p.status='attended'),
    'spectacles',(select count(*) from camp_people p join camps c on c.id=p.camp_id where c.deleted_at is null and 'Spectacles given'=any(p.actions)),
    'cancer_screened',(select count(*) from camp_people p join camps c on c.id=p.camp_id where c.deleted_at is null and c.camp_type='Cancer awareness' and p.status='attended'),
    'meals',(select coalesce(sum(f.people),0) from camp_food f join camps c on c.id=f.camp_id where c.deleted_at is null),
    'saplings',(select coalesce(sum(s.count),0) from camp_saplings s join camps c on c.id=s.camp_id where c.deleted_at is null),
    'hours',(select coalesce(sum(hours),0) from project_hours where approved),
    'members',(select count(*) from members where deleted_at is null and status='active'),
    'by_group',(select jsonb_object_agg(g,n) from (select d.blood_group::text g,count(*) n from donations x join registrations r on r.id=x.registration_id join donors d on d.id=r.donor_id where d.blood_group is not null group by 1) s),
    'by_month',(select coalesce(jsonb_agg(jsonb_build_object('m',m,'n',n) order by m),'[]') from (select to_char(c.camp_date,'YYYY-MM') m,count(*) n from donations x join registrations r on r.id=x.registration_id join camps c on c.id=r.camp_id
      where c.camp_date>=(current_date-interval '12 months') group by 1) s),
    'next_camp',(select jsonb_build_object('id',id,'name',name,'date',camp_date,'venue',venue,'type',camp_type) from camps where deleted_at is null and status='open' and camp_date>=current_date order by camp_date limit 1)) $$;
grant execute on function public_impact() to anon, authenticated;

-- ---------- bulk import: people, food, saplings ----------
create or replace function import_spec(p_entity text) returns jsonb language sql immutable as $$
  select case p_entity
  when 'donors' then '{"table":"donors","label":"Donors","perms":["donors"],"pk":["id"],"soft":true,
     "cols":["full_name","phone","email","blood_group","gender","dob","address","area","last_donation","consent","donor_no"],
     "required":["full_name","phone"],"keys":[["donor_no"],["phone"],["email"]],"code":{"col":"donor_no","p":"D","w":4,"seq":"donor_no_seq"},"name":"full_name"}'::jsonb
  when 'members' then '{"table":"members","label":"Members","perms":["members"],"pk":["id"],"soft":true,
     "cols":["member_no","full_name","phone","email","dob","gender","blood_group","address","area","occupation","organisation","position","membership_type","status","joined_on","left_on","ri_member_id","emergency_contact","notes"],
     "required":["full_name"],"keys":[["member_no"],["phone"],["email"],["ri_member_id"]],"code":{"col":"member_no","p":"M","w":3,"seq":"members_member_no_seq"},"name":"full_name"}'::jsonb
  when 'member_dues' then '{"table":"member_dues","label":"Member payments","perms":["members"],"pk":["id"],"soft":false,
     "cols":["receipt_no","member_id","period","paid_on","subscription","donation","mode","reference","notes"],
     "required":["member_id"],"refs":{"member_ref":"member_id"},"keys":[["receipt_no"],["member_id","paid_on","subscription"]],
     "code":{"col":"receipt_no","p":"RC","w":4,"seq":"member_dues_receipt_no_seq"},"name":"period"}'::jsonb
  when 'donor_events' then '{"table":"donor_events","label":"Past blood donations","perms":["donors"],"pk":["id"],"soft":false,
     "cols":["donor_id","event_date","kind","place","units","notes"],
     "required":["donor_id","event_date"],"refs":{"donor_ref":"donor_id"},"keys":[["donor_id","event_date","kind"]],
     "code":{"col":"event_no","p":"DE","w":4,"seq":"donor_events_no_seq"},"name":"place","defaults":{"kind":"outside_donation","units":1}}'::jsonb
  when 'camps' then '{"table":"camps","label":"Camps","perms":["camps"],"pk":["id"],"soft":true,
     "cols":["camp_no","name","camp_type","camp_type_other","camp_date","start_time","end_time","venue","target_donors","slot_capacity","status","budget","beneficiaries","about","partner","partner_contact","doctors","target_people"],
     "required":["name","camp_date"],"keys":[["camp_no"],["name","camp_date"]],"code":{"col":"camp_no","p":"C","w":3,"seq":"camp_no_seq"},"name":"name",
     "defaults":{"start_time":"09:00","end_time":"15:00","status":"completed","camp_type":"Blood donation"}}'::jsonb
  when 'camp_attendance' then '{"table":"camp_attendance","label":"Camp attendance","perms":["camps","members"],"pk":["camp_id","member_id"],"soft":false,
     "cols":["camp_id","member_id","status","late_minutes","duty"],"required":["camp_id","member_id"],"refs":{"camp_ref":"camp_id","member_ref":"member_id"},
     "keys":[["camp_id","member_id"]],"name":"status","defaults":{"status":"present"}}'::jsonb
  when 'camp_people' then '{"table":"camp_people","label":"People at eye / cancer / other camps","perms":["camps","campday"],"pk":["id"],"soft":false,
     "cols":["camp_id","full_name","age","gender","phone","area","address","status","screenings","findings","actions","result","vision_right","vision_left","power","referred_to","follow_up","follow_up_on","notes","consent"],
     "required":["camp_id","full_name"],"refs":{"camp_ref":"camp_id"},"keys":[["camp_id","phone"],["camp_id","full_name","age"]],"name":"full_name","defaults":{"source":"import","status":"attended"}}'::jsonb
  when 'camp_food' then '{"table":"camp_food","label":"Food distribution","perms":["camps","campday"],"pk":["id"],"soft":false,
     "cols":["camp_id","place","group_type","people","packets","items","served_at","served_by","notes"],
     "required":["camp_id","place"],"refs":{"camp_ref":"camp_id"},"keys":[["camp_id","place","served_at"]],"name":"place"}'::jsonb
  when 'camp_saplings' then '{"table":"camp_saplings","label":"Saplings planted","perms":["camps","campday"],"pk":["id"],"soft":false,
     "cols":["camp_id","species","count","place","landmark","lat","lng","planted_by","guardian","guardian_phone","notes"],
     "required":["camp_id","species","count"],"refs":{"camp_ref":"camp_id"},"keys":[["camp_id","species","place"]],"name":"species"}'::jsonb
  when 'meetings' then '{"table":"meetings","label":"Meetings","perms":["meetings"],"pk":["id"],"soft":true,
     "cols":["meeting_no","kind","kind_other","audience","title","meeting_date","start_time","end_time","venue","mode","online_link","chaired_by","minutes_by","chief_guest","guests","guest_names","agenda","minutes","decisions","status"],
     "required":["title","meeting_date"],"keys":[["meeting_no"],["title","meeting_date"]],"code":{"col":"meeting_no","p":"MT","w":3,"seq":"meetings_meeting_no_seq"},"name":"title",
     "defaults":{"status":"held","kind":"Weekly"}}'::jsonb
  when 'meeting_attendance' then '{"table":"meeting_attendance","label":"Meeting attendance","perms":["meetings"],"pk":["meeting_id","member_id"],"soft":false,
     "cols":["meeting_id","member_id","status","late_minutes","note"],"required":["meeting_id","member_id"],"refs":{"meeting_ref":"meeting_id","member_ref":"member_id"},
     "keys":[["meeting_id","member_id"]],"name":"status","defaults":{"status":"present"}}'::jsonb
  when 'hospitals' then '{"table":"hospitals","label":"Hospitals and blood banks","perms":["emergency","camps","afterlife"],"pk":["id"],"soft":true,
     "cols":["name","kind","city","address","phone","phone2","contact_person","email","open_24x7","tie_up","blood_groups_note","notes"],
     "required":["name"],"keys":[["name","city"],["phone"]],"name":"name"}'::jsonb
  when 'projects' then '{"table":"projects","label":"Service projects","perms":["members"],"pk":["id"],"soft":true,
     "cols":["project_no","title","avenue","status","start_date","end_date","venue","partner","beneficiaries","budget","spent","description","outcome"],
     "required":["title"],"keys":[["project_no"],["title","start_date"]],"code":{"col":"project_no","p":"P","w":3,"seq":"projects_no_seq"},"name":"title"}'::jsonb
  when 'events' then '{"table":"events","label":"Club events","perms":["meetings","members"],"pk":["id"],"soft":true,
     "cols":["event_no","title","kind","event_date","start_time","end_time","venue","capacity","open_registration","fee","description","status"],
     "required":["title","event_date"],"keys":[["event_no"],["title","event_date"]],"code":{"col":"event_no","p":"E","w":3,"seq":"events_no_seq"},"name":"title"}'::jsonb
  end $$;

-- materials can also come from the camp partner (eye hospital, school ...)
alter table camp_materials drop constraint if exists camp_materials_source_check;
alter table camp_materials add constraint camp_materials_source_check check (source in ('To buy','Sponsored','Borrowed','Blood bank','Club stock','Partner'));
