-- v5: club members and dues, meetings with attendance and minutes, eye/body donation (pledges and cases),
-- full donor history, and an unguessable certificate check code. Run once, after v4. Nothing is dropped.

-- ---------- permissions: three new modules ----------
create or replace function role_default_perms(r app_role) returns text[] language sql immutable set search_path=public as $$
  select case r
    when 'admin' then array['donors','camps','import','planning','campday','screening','messages','stock','stock_edit','emergency','reports','users','audit','settings','members','meetings','afterlife']
    when 'coordinator' then array['donors','camps','import','planning','campday','messages','stock','emergency','reports','members','meetings','afterlife']
    when 'medical' then array['campday','screening','stock','stock_edit','emergency','afterlife']
    when 'volunteer' then array['campday']
    else array[]::text[] end $$;

-- ---------- certificate check code (12 random characters, printed under the QR) ----------
create or replace function new_check_code() returns text language sql volatile as $$
  select upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)) $$;
alter table donations add column if not exists verify_code text;
update donations set verify_code=new_check_code() where verify_code is null;
alter table donations alter column verify_code set default new_check_code();
alter table donations alter column verify_code set not null;
create unique index if not exists donations_verify_code_uq on donations(verify_code);

-- Only the check code (or the older 8-character code) opens a certificate. A certificate number alone does not.
create or replace function verify_certificate(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; c text := upper(regexp_replace(coalesce(p_code,''),'[^0-9A-Za-z]','','g')); begin
  if c ~ '^(CRT)?[0-9]{1,9}$' then return jsonb_build_object('error','need code'); end if;
  if length(c) not in (8,12) then return jsonb_build_object('error','not found'); end if;
  select jsonb_build_object('name',trim(split_part(d.full_name,' ',1)||' '||left(regexp_replace(d.full_name,'^\S+\s*',''),1)),
    'camp',cp.name,'venue',cp.venue,'date',cp.camp_date,'blood_group',d.blood_group,'volume',dn.volume_ml,'cert_no',dn.cert_no,
    'code',dn.verify_code,'club',(select club_name from settings where id=1)) into r
  from donations dn join registrations rg on rg.id=dn.registration_id join donors d on d.id=rg.donor_id join camps cp on cp.id=rg.camp_id
  where (length(c)=12 and dn.verify_code=c) or (length(c)=8 and upper(left(rg.id::text,8))=c) limit 1;
  return coalesce(r,jsonb_build_object('error','not found')); end $$;
grant execute on function verify_certificate(text) to anon, authenticated;

create or replace function my_portal() returns jsonb language plpgsql security definer set search_path=public as $$
declare d donors; begin
  select * into d from donors where user_id=auth.uid() and deleted_at is null;
  return jsonb_build_object(
    'donor', case when d.id is null then null else jsonb_build_object('name',d.full_name,'donor_no',d.donor_no,'blood_group',d.blood_group,'gender',d.gender,'last_donation',d.last_donation) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('code',upper(left(r.id::text,8)),'cert_no',n.cert_no,'verify_code',n.verify_code,'camp',c.name,'venue',c.venue,'date',c.camp_date,'volume',n.volume_ml) order by c.camp_date desc)
      from registrations r join donations n on n.registration_id=r.id join camps c on c.id=r.camp_id where r.donor_id=d.id),'[]'::jsonb),
    'outside', coalesce((select jsonb_agg(jsonb_build_object('date',e.event_date,'place',e.place,'kind',e.kind,'units',e.units) order by e.event_date desc)
      from donor_events e where e.donor_id=d.id and e.kind in ('outside_donation','emergency_donation')),'[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('camp_id',c.id,'camp',c.name,'date',c.camp_date,'venue',c.venue,'slot',r.slot,'token_no',r.token_no) order by c.camp_date)
      from registrations r join camps c on c.id=r.camp_id where r.donor_id=d.id and r.status in ('registered','checked_in') and c.status in ('open','live','planned') and c.deleted_at is null),'[]'::jsonb),
    'open_camps', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'date',c.camp_date,'venue',c.venue,'start_time',c.start_time,'end_time',c.end_time) order by c.camp_date)
      from camps c where c.status='open' and c.deleted_at is null),'[]'::jsonb));
end $$;

-- ---------- donor history: donations elsewhere, emergency donations, calls and notes ----------
create sequence if not exists donor_events_no_seq;
create table if not exists donor_events(
  id uuid primary key default gen_random_uuid(),
  event_no int not null unique,
  donor_id uuid not null references donors on delete cascade,
  event_date date not null default current_date,
  kind text not null check (kind in ('outside_donation','emergency_donation','call','note','award','deferral')),
  place text, units int, notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now());
create index if not exists donor_events_donor on donor_events(donor_id, event_date desc);
alter table donor_events enable row level security;
create policy "donor events manage" on donor_events for all using (perm('donors')) with check (perm('donors'));

-- Everything that happened with one donor, newest first. Health readings only for medical staff.
create or replace function donor_history(p_donor uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare med boolean := perm('screening'); begin
  if not (perm('donors') or med) then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'stats',(select jsonb_build_object(
        'donations',(select count(*) from donations n join registrations r on r.id=n.registration_id where r.donor_id=p_donor)
                   +(select coalesce(sum(coalesce(units,1)),0) from donor_events where donor_id=p_donor and kind in ('outside_donation','emergency_donation')),
        'ml',(select coalesce(sum(n.volume_ml),0) from donations n join registrations r on r.id=n.registration_id where r.donor_id=p_donor),
        'camps',(select count(*) from registrations where donor_id=p_donor),
        'deferred',(select count(*) from registrations where donor_id=p_donor and status='deferred'),
        'no_show',(select count(*) from registrations where donor_id=p_donor and status='no_show'),
        'messages',(select count(*) from message_log where donor_id=p_donor),
        'first',(select min(d) from (select c.camp_date d from donations n join registrations r on r.id=n.registration_id join camps c on c.id=r.camp_id where r.donor_id=p_donor
                  union all select event_date from donor_events where donor_id=p_donor and kind in ('outside_donation','emergency_donation')) x),
        'last',(select max(d) from (select c.camp_date d from donations n join registrations r on r.id=n.registration_id join camps c on c.id=r.camp_id where r.donor_id=p_donor
                  union all select event_date from donor_events where donor_id=p_donor and kind in ('outside_donation','emergency_donation')) x))),
    'timeline',coalesce((select jsonb_agg(t order by t->>'date' desc, t->>'at' desc) from (
      select jsonb_build_object('type','camp','date',c.camp_date,'at',r.created_at,'camp',c.name,'camp_no',c.camp_no,'venue',c.venue,'status',r.status,'token',r.token_no,'slot',r.slot,
        'bag',n.bag_number,'volume',n.volume_ml,'cert_no',n.cert_no,'reaction',n.reaction,
        'decision',s.decision,'defer_reason',case when med then s.defer_reason end,'defer_until',s.defer_until,
        'hb',case when med then s.hb end,'bp',case when med and s.systolic is not null then s.systolic||'/'||s.diastolic end,'weight',case when med then s.weight_kg end,'pulse',case when med then s.pulse end) t
      from registrations r join camps c on c.id=r.camp_id left join donations n on n.registration_id=r.id left join screenings s on s.registration_id=r.id where r.donor_id=p_donor
      union all
      select jsonb_build_object('type','event','id',e.id,'event_no',e.event_no,'date',e.event_date,'at',e.created_at,'kind',e.kind,'place',e.place,'units',e.units,'notes',e.notes,
        'by',(select full_name from profiles where id=e.created_by)) from donor_events e where e.donor_id=p_donor
      union all
      select jsonb_build_object('type','message','date',(m.created_at at time zone 'Asia/Kolkata')::date,'at',m.created_at,'kind',m.kind,'ref',m.ref,
        'by',(select full_name from profiles where id=m.sent_by)) from message_log m where m.donor_id=p_donor
      union all
      select jsonb_build_object('type','added','date',(d.created_at at time zone 'Asia/Kolkata')::date,'at',d.created_at,'source',d.source) from donors d where d.id=p_donor
    ) q(t)),'[]'::jsonb));
end $$;
revoke execute on function donor_history(uuid) from public, anon;
grant execute on function donor_history(uuid) to authenticated;

-- keep last_donation in step when a donation elsewhere is logged
create or replace function donor_event_last() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.kind in ('outside_donation','emergency_donation') then
    update donors set last_donation=new.event_date where id=new.donor_id and (last_donation is null or last_donation<new.event_date); end if;
  return new; end $$;
create or replace trigger donor_event_last after insert or update on donor_events for each row execute function donor_event_last();

-- ---------- club members ----------
create sequence if not exists members_member_no_seq;
create table if not exists members(
  id uuid primary key default gen_random_uuid(),
  member_no int not null unique,
  full_name text not null, phone text, email text, dob date, gender text, blood_group blood_group,
  address text, area text, occupation text, organisation text,
  position text not null default 'Member', membership_type text not null default 'Active' check (membership_type in ('Active','Prospective','Honorary','Alumni')),
  status text not null default 'active' check (status in ('active','inactive','resigned')),
  joined_on date, left_on date, ri_member_id text, emergency_contact text, notes text,
  donor_id uuid references donors on delete set null, profile_id uuid references profiles on delete set null,
  created_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);
alter table members enable row level security;
create policy "members manage" on members for all using (perm('members')) with check (perm('members'));
create policy "members read for meetings" on members for select using (perm('meetings'));

create sequence if not exists member_dues_receipt_no_seq;
create table if not exists member_dues(
  id uuid primary key default gen_random_uuid(),
  receipt_no int not null unique,
  member_id uuid not null references members on delete cascade,
  period text not null, amount numeric(10,2) not null, paid_on date not null default current_date,
  mode text not null default 'Cash' check (mode in ('Cash','UPI','Bank transfer','Cheque')), reference text, notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now());
alter table member_dues enable row level security;
create policy "dues manage" on member_dues for all using (perm('members')) with check (perm('members'));

-- ---------- meetings ----------
create sequence if not exists meetings_meeting_no_seq;
create table if not exists meetings(
  id uuid primary key default gen_random_uuid(),
  meeting_no int not null unique,
  kind text not null default 'Weekly' check (kind in ('Weekly','Monthly','Board','General body','Special','Joint','Installation')),
  title text not null, meeting_date date not null, start_time time, end_time time,
  venue text, mode text not null default 'In person' check (mode in ('In person','Online','Hybrid')), online_link text,
  chaired_by text, minutes_by text, chief_guest text, guests int not null default 0, guest_names text,
  agenda text, minutes text, decisions text, next_meeting date,
  status text not null default 'scheduled' check (status in ('scheduled','held','cancelled')),
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);
alter table meetings enable row level security;
create policy "meetings manage" on meetings for all using (perm('meetings')) with check (perm('meetings'));

create table if not exists meeting_attendance(
  meeting_id uuid not null references meetings on delete cascade,
  member_id uuid not null references members on delete cascade,
  status text not null default 'present' check (status in ('present','late','leave','absent')),
  noted_at timestamptz not null default now(),
  primary key(meeting_id,member_id));
alter table meeting_attendance enable row level security;
create policy "attendance manage" on meeting_attendance for all using (perm('meetings')) with check (perm('meetings'));

create sequence if not exists meeting_actions_action_no_seq;
create table if not exists meeting_actions(
  id uuid primary key default gen_random_uuid(),
  action_no int not null unique,
  meeting_id uuid not null references meetings on delete cascade,
  task text not null, owner_member uuid references members on delete set null, due date, done boolean not null default false,
  created_at timestamptz not null default now());
alter table meeting_actions enable row level security;
create policy "actions manage" on meeting_actions for all using (perm('meetings')) with check (perm('meetings'));

-- attendance per member for a period (only meetings that were held)
create or replace function attendance_summary(p_from date, p_to date) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not (perm('meetings') or perm('members')) then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'meetings',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'no',m.meeting_no,'kind',m.kind,'title',m.title,'date',m.meeting_date,
        'present',(select count(*) from meeting_attendance a where a.meeting_id=m.id and a.status in ('present','late')),'guests',m.guests) order by m.meeting_date)
      from meetings m where m.status='held' and m.deleted_at is null and m.meeting_date between p_from and p_to),'[]'::jsonb),
    'members',coalesce((select jsonb_agg(x order by x->>'name') from (select jsonb_build_object('id',mb.id,'no',mb.member_no,'name',mb.full_name,'position',mb.position,
        'held',(select count(*) from meetings m where m.status='held' and m.deleted_at is null and m.meeting_date between greatest(p_from,coalesce(mb.joined_on,p_from)) and p_to),
        'present',(select count(*) from meeting_attendance a join meetings m on m.id=a.meeting_id where a.member_id=mb.id and a.status in ('present','late') and m.status='held' and m.deleted_at is null and m.meeting_date between p_from and p_to),
        'leave',(select count(*) from meeting_attendance a join meetings m on m.id=a.meeting_id where a.member_id=mb.id and a.status='leave' and m.status='held' and m.deleted_at is null and m.meeting_date between p_from and p_to)) x
      from members mb where mb.deleted_at is null and mb.status='active') s(x)),'[]'::jsonb));
end $$;
revoke execute on function attendance_summary(date,date) from public, anon;
grant execute on function attendance_summary(date,date) to authenticated;

-- one member: details, dues, attendance and (if linked) blood donations
create or replace function member_profile(p_member uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare m members; begin
  if not (perm('members') or perm('meetings')) then raise exception 'Not allowed'; end if;
  select * into m from members where id=p_member;
  return jsonb_build_object(
    'dues',coalesce((select jsonb_agg(to_jsonb(d) order by d.paid_on desc) from member_dues d where d.member_id=p_member and perm('members')),'[]'::jsonb),
    'meetings',coalesce((select jsonb_agg(jsonb_build_object('no',mt.meeting_no,'date',mt.meeting_date,'kind',mt.kind,'title',mt.title,'status',coalesce(a.status,'absent')) order by mt.meeting_date desc)
      from meetings mt left join meeting_attendance a on a.meeting_id=mt.id and a.member_id=p_member
      where mt.status='held' and mt.deleted_at is null and mt.meeting_date>=coalesce(m.joined_on,'1900-01-01')),'[]'::jsonb),
    'actions',coalesce((select jsonb_agg(jsonb_build_object('task',x.task,'due',x.due,'done',x.done,'meeting_no',mt.meeting_no) order by x.done, x.due nulls last)
      from meeting_actions x join meetings mt on mt.id=x.meeting_id where x.owner_member=p_member),'[]'::jsonb),
    'donations',case when m.donor_id is null then null else (select count(*) from donations n join registrations r on r.id=n.registration_id where r.donor_id=m.donor_id)
      +(select coalesce(sum(coalesce(units,1)),0) from donor_events where donor_id=m.donor_id and kind in ('outside_donation','emergency_donation')) end,
    'donor_no',(select donor_no from donors where id=m.donor_id));
end $$;
revoke execute on function member_profile(uuid) from public, anon;
grant execute on function member_profile(uuid) to authenticated;

-- ---------- eye, body, organ and skin donation after death ----------
create sequence if not exists pledges_pledge_no_seq;
create table if not exists pledges(
  id uuid primary key default gen_random_uuid(),
  pledge_no int not null unique,
  full_name text not null, phone text, dob date, gender text, blood_group blood_group, address text, area text,
  eye boolean not null default true, body boolean not null default false, organ boolean not null default false, skin boolean not null default false,
  pledged_on date not null default current_date, witness_name text, witness_phone text, family_contact text, family_phone text,
  family_informed boolean not null default false, card_issued boolean not null default false, institution text, notes text,
  status text not null default 'active' check (status in ('active','fulfilled','withdrawn','deceased')),
  donor_id uuid references donors on delete set null, member_id uuid references members on delete set null,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);
alter table pledges enable row level security;
create policy "pledges manage" on pledges for all using (perm('afterlife')) with check (perm('afterlife'));

create sequence if not exists afterlife_cases_case_no_seq;
create table if not exists afterlife_cases(
  id uuid primary key default gen_random_uuid(),
  case_no int not null unique,
  kinds text[] not null default array['eye'],
  deceased_name text not null, age int, gender text, address text, area text, religion_note text,
  died_on date not null, died_at time, cause_of_death text, place_of_death text check (place_of_death in ('Home','Hospital','Other')), hospital_name text,
  informed_at timestamptz, collected_at timestamptz, institution text, institution_contact text, team_lead text, technician text,
  corneas int check (corneas between 0 and 2), body_received_by text,
  family_contact text not null, family_relation text, family_phone text, consent_by text, consent_form boolean not null default false,
  coordinated_by text, pledge_id uuid references pledges on delete set null,
  status text not null default 'informed' check (status in ('informed','team sent','collected','handed over','not suitable','family declined')),
  not_suitable_reason text, letter_issued boolean not null default false, notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);
alter table afterlife_cases enable row level security;
create policy "cases manage" on afterlife_cases for all using (perm('afterlife')) with check (perm('afterlife'));

-- a completed case marks the linked pledge as fulfilled
create or replace function case_to_pledge() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.pledge_id is not null then
    update pledges set status=case when new.status in ('collected','handed over') then 'fulfilled' else 'deceased' end
    where id=new.pledge_id and status in ('active','deceased'); end if;
  return new; end $$;
create or replace trigger case_to_pledge after insert or update of status, pledge_id on afterlife_cases for each row execute function case_to_pledge();

create or replace function afterlife_summary(p_from date, p_to date) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not perm('afterlife') then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'pledges',(select count(*) from pledges where deleted_at is null and pledged_on between p_from and p_to),
    'pledges_total',(select count(*) from pledges where deleted_at is null and status='active'),
    'cases',(select count(*) from afterlife_cases where deleted_at is null and died_on between p_from and p_to),
    'eye',(select count(*) from afterlife_cases where deleted_at is null and died_on between p_from and p_to and 'eye'=any(kinds) and status in ('collected','handed over')),
    'body',(select count(*) from afterlife_cases where deleted_at is null and died_on between p_from and p_to and 'body'=any(kinds) and status in ('collected','handed over')),
    'organ',(select count(*) from afterlife_cases where deleted_at is null and died_on between p_from and p_to and 'organ'=any(kinds) and status in ('collected','handed over')),
    'skin',(select count(*) from afterlife_cases where deleted_at is null and died_on between p_from and p_to and 'skin'=any(kinds) and status in ('collected','handed over')),
    'corneas',(select coalesce(sum(corneas),0) from afterlife_cases where deleted_at is null and died_on between p_from and p_to and status in ('collected','handed over')),
    'by_month',coalesce((select jsonb_agg(jsonb_build_object('month',m,'cases',n) order by m) from (select to_char(died_on,'YYYY-MM') m,count(*) n from afterlife_cases
       where deleted_at is null and died_on between p_from and p_to and status in ('collected','handed over') group by 1) x),'[]'::jsonb));
end $$;
revoke execute on function afterlife_summary(date,date) from public, anon;
grant execute on function afterlife_summary(date,date) to authenticated;

-- ---------- checks with friendly messages ----------
create or replace function validate_club_row() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_table_name in ('members','pledges') then
    if length(trim(coalesce(new.full_name,'')))<2 then raise exception 'Enter the full name'; end if;
    if coalesce(new.phone,'')<>'' and new.phone !~ '^[6-9][0-9]{9}$' then raise exception 'Mobile number must be 10 digits and start with 6, 7, 8 or 9'; end if;
    if new.dob is not null and new.dob > current_date then raise exception 'Date of birth cannot be in the future'; end if;
    new.full_name := trim(new.full_name);
  end if;
  if tg_table_name='members' then
    if coalesce(new.email,'')<>'' and new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email or leave it empty'; end if;
    if new.joined_on is not null and new.joined_on > current_date then raise exception 'Joining date cannot be in the future'; end if;
  elsif tg_table_name='pledges' then
    if not (new.eye or new.body or new.organ or new.skin) then raise exception 'Choose at least one pledge: eye, body, organ or skin'; end if;
    if new.pledged_on > current_date then raise exception 'Pledge date cannot be in the future'; end if;
    if coalesce(new.witness_phone,'')<>'' and new.witness_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Witness mobile must be 10 digits'; end if;
  elsif tg_table_name='member_dues' then
    if new.amount is null or new.amount<=0 then raise exception 'Amount must be more than 0'; end if;
    if coalesce(trim(new.period),'')='' then raise exception 'Enter the period, for example 2026-27 or Oct 2026'; end if;
    if new.paid_on > current_date then raise exception 'Paid date cannot be in the future'; end if;
  elsif tg_table_name='meetings' then
    if length(trim(coalesce(new.title,'')))<3 then raise exception 'Enter the meeting title'; end if;
    if new.end_time is not null and new.start_time is not null and new.end_time<=new.start_time then raise exception 'End time must be after start time'; end if;
    if new.status='held' and new.meeting_date > current_date then raise exception 'A future meeting cannot be marked as held'; end if;
    if new.guests<0 then raise exception 'Guests cannot be negative'; end if;
  elsif tg_table_name='meeting_actions' then
    if length(trim(coalesce(new.task,'')))<2 then raise exception 'Enter the action item'; end if;
  elsif tg_table_name='afterlife_cases' then
    if length(trim(coalesce(new.deceased_name,'')))<2 then raise exception 'Enter the name of the deceased'; end if;
    if new.died_on > current_date then raise exception 'Date of death cannot be in the future'; end if;
    if new.age is not null and new.age not between 0 and 120 then raise exception 'Age must be between 0 and 120'; end if;
    if coalesce(trim(new.family_contact),'')='' then raise exception 'Enter the family member who gave consent'; end if;
    if coalesce(new.family_phone,'')<>'' and new.family_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Family mobile must be 10 digits'; end if;
    if array_length(new.kinds,1) is null or not new.kinds <@ array['eye','body','organ','skin'] then raise exception 'Choose what was donated: eye, body, organ or skin'; end if;
    if new.collected_at is not null and new.died_at is not null and new.collected_at < ((new.died_on + new.died_at) at time zone 'Asia/Kolkata') then raise exception 'Collection time cannot be before the time of death'; end if;
    if new.status in ('collected','handed over') and new.collected_at is null then raise exception 'Enter the collection date and time'; end if;
    if new.status='not suitable' and coalesce(trim(new.not_suitable_reason),'')='' then raise exception 'Say why it was not suitable'; end if;
  elsif tg_table_name='donor_events' then
    if new.event_date > current_date then raise exception 'Date cannot be in the future'; end if;
    if new.kind in ('outside_donation','emergency_donation') and coalesce(trim(new.place),'')='' then raise exception 'Enter where the donation happened'; end if;
    if new.units is not null and new.units not between 1 and 4 then raise exception 'Units must be between 1 and 4'; end if;
  end if;
  -- serial numbers are given only after the checks pass, so a rejected entry never leaves a gap
  if tg_op='INSERT' then
    if tg_table_name='members' then new.member_no := coalesce(new.member_no,nextval('members_member_no_seq'));
    elsif tg_table_name='member_dues' then new.receipt_no := coalesce(new.receipt_no,nextval('member_dues_receipt_no_seq'));
    elsif tg_table_name='meetings' then new.meeting_no := coalesce(new.meeting_no,nextval('meetings_meeting_no_seq'));
    elsif tg_table_name='meeting_actions' then new.action_no := coalesce(new.action_no,nextval('meeting_actions_action_no_seq'));
    elsif tg_table_name='pledges' then new.pledge_no := coalesce(new.pledge_no,nextval('pledges_pledge_no_seq'));
    elsif tg_table_name='afterlife_cases' then new.case_no := coalesce(new.case_no,nextval('afterlife_cases_case_no_seq'));
    elsif tg_table_name='donor_events' then new.event_no := coalesce(new.event_no,nextval('donor_events_no_seq'));
    end if;
  end if;
  return new; end $$;


do $$ declare t text; begin
  foreach t in array array['members','member_dues','meetings','meeting_actions','pledges','afterlife_cases','donor_events'] loop
    execute format('create or replace trigger validate_%1$s before insert or update on %1$I for each row execute function validate_club_row()', t);
  end loop;
  foreach t in array array['members','member_dues','meetings','meeting_attendance','meeting_actions','pledges','afterlife_cases','donor_events'] loop
    execute format('create or replace trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_row()', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['members','member_dues','meetings','meeting_attendance','meeting_actions','pledges','afterlife_cases','donor_events'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table %I', t); end if;
    end loop; end if;
end $$;
grant usage, select on sequence donor_events_no_seq, members_member_no_seq, member_dues_receipt_no_seq, meetings_meeting_no_seq, meeting_actions_action_no_seq,
  pledges_pledge_no_seq, afterlife_cases_case_no_seq to authenticated;
revoke execute on function new_check_code(), donor_event_last(), case_to_pledge(), validate_club_row() from public, anon, authenticated;
grant execute on function new_check_code() to authenticated;
alter function public.new_check_code() set search_path = public;
alter function public._pk(text) set search_path = public;
alter function public.add_serial(text,text) set search_path = public;
revoke execute on function public.set_token_no() from public, anon, authenticated;
