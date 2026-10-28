-- v18: Lionism year, year-wise board, meeting types/board meetings/monthly series/prepone-postpone,
-- late minutes, camp types with member attendance, subscription + donation with alerts,
-- email (Resend / SendGrid) with templates, daily send time and a morning self-check. Run once, after v17.
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net not available: %', sqlerrm; end $$;

-- ======================= club year (July to June) =======================
alter table settings add column if not exists year_label text not null default 'Lionism year';
alter table settings add column if not exists member_subscription numeric(10,2) not null default 15000;
do $$ begin if not exists(select 1 from pg_constraint where conname='settings_member_subscription_ok') then
  alter table settings add constraint settings_member_subscription_ok check (member_subscription>=0); end if; end $$;

create or replace function ist_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;
-- '2026-27' for any date from 1 July 2026 to 30 June 2027
create or replace function club_year(p date) returns text language sql immutable as $$
  select (case when extract(month from p)>=7 then extract(year from p)::int else extract(year from p)::int-1 end)::text||'-'||
         lpad(((case when extract(month from p)>=7 then extract(year from p)::int else extract(year from p)::int-1 end + 1) % 100)::text,2,'0') $$;
create or replace function club_year_from(p_year text) returns date language sql immutable as $$ select make_date(left(p_year,4)::int,7,1) $$;

-- ======================= board, year by year =======================
-- board_terms holds the board of every year. Past years never change; the current year follows member positions.
create or replace function board_member_ids(p_year text) returns setof uuid language sql stable security definer set search_path=public as $$
  select member_id from board_terms where rotary_year=p_year and member_id is not null
  union
  select id from members where p_year=club_year(ist_today()) and deleted_at is null and status='active' and position<>'Member'
    and not exists(select 1 from board_terms b where b.rotary_year=p_year) $$;

create or replace function board_of_year(p_year text) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not (perm('members') or perm('meetings') or (my_member()).id is not null) then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('member_id',x.member_id,'name',x.name,'position',x.position,'member_no',m.member_no) order by m.member_no nulls last)
    from (select member_id, member_name name, position from board_terms where rotary_year=p_year
          union all
          select id, full_name, position from members where p_year=club_year(ist_today()) and deleted_at is null and status='active' and position<>'Member'
            and not exists(select 1 from board_terms b where b.rotary_year=p_year)) x left join members m on m.id=x.member_id),'[]'); end $$;
grant execute on function board_of_year(text) to authenticated; revoke execute on function board_of_year(text) from public, anon;
revoke execute on function board_member_ids(text) from public, anon;

-- keep the current year's board in step with member positions (past years stay as they were)
create or replace function sync_board_term() returns trigger language plpgsql security definer set search_path=public as $$
declare y text := club_year(ist_today()); begin
  if coalesce(current_setting('app.newyear',true),'')='1' then return new; end if;
  if tg_op='UPDATE' and new.position is not distinct from old.position and new.full_name is not distinct from old.full_name and new.deleted_at is not distinct from old.deleted_at and new.status is not distinct from old.status then return new; end if;
  if not exists(select 1 from board_terms where rotary_year=y) then   -- first change this year: save the board as it was
    insert into board_terms(rotary_year,member_id,member_name,position)
      select y,id,full_name,position from members where deleted_at is null and status='active' and position<>'Member' and id<>new.id on conflict do nothing; end if;
  delete from board_terms where rotary_year=y and member_id=new.id;
  if new.deleted_at is null and new.status='active' and new.position<>'Member' then
    insert into board_terms(rotary_year,member_id,member_name,position) values(y,new.id,new.full_name,new.position) on conflict do nothing; end if;
  return new; end $$;
drop trigger if exists board_sync on members;
create trigger board_sync after insert or update of position, full_name, status, deleted_at on members for each row execute function sync_board_term();
grant delete on board_terms to authenticated;

create or replace function start_rotary_year(p_year text, p_board jsonb) returns int language plpgsql security definer set search_path=public as $$
declare x jsonb; n int := 0; prev text; begin
  if not perm('members') then raise exception 'Not allowed'; end if;
  if p_year !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'The year looks like 2026-27'; end if;
  prev := (left(p_year,4)::int-1)::text||'-'||lpad((left(p_year,4)::int % 100)::text,2,'0');
  perform set_config('app.newyear','1',true);
  insert into board_terms(rotary_year,member_id,member_name,position)   -- outgoing board, if not saved already
    select prev,id,full_name,position from members where deleted_at is null and position<>'Member'
      and not exists(select 1 from board_terms b where b.rotary_year=prev) on conflict do nothing;
  delete from board_terms where rotary_year=p_year;
  update members set position='Member' where deleted_at is null and position<>'Member';
  for x in select * from jsonb_array_elements(p_board) loop
    if coalesce(x->>'member_id','')='' or coalesce(x->>'position','')='' then continue; end if;
    update members set position=x->>'position' where id=(x->>'member_id')::uuid;
    insert into board_terms(rotary_year,member_id,member_name,position) select p_year,id,full_name,x->>'position' from members where id=(x->>'member_id')::uuid on conflict do nothing;
    update profiles set designation=x->>'position' where id=(select profile_id from members where id=(x->>'member_id')::uuid);
    n := n+1; end loop;
  perform set_config('app.newyear','',true);
  return n; end $$;

-- ======================= meetings =======================
alter table meetings drop constraint if exists meetings_kind_check;
alter table meetings add constraint meetings_kind_check check (kind in ('Weekly','Monthly','Board','General body','Special','Joint','Installation','Others'));
alter table meetings add column if not exists kind_other text;
alter table meetings add column if not exists audience text not null default 'all';
alter table meetings drop constraint if exists meetings_audience_check;
alter table meetings add constraint meetings_audience_check check (audience in ('all','board'));
alter table meetings add column if not exists series_id uuid;
alter table meetings add column if not exists original_date date;
alter table meetings add column if not exists original_start time;
alter table meetings add column if not exists reschedules int not null default 0;
update meetings set audience='board' where kind='Board' and audience<>'board';

alter table meeting_attendance add column if not exists late_minutes int;
alter table meeting_attendance drop constraint if exists meeting_attendance_late_ok;
alter table meeting_attendance add constraint meeting_attendance_late_ok check (late_minutes is null or late_minutes between 0 and 600);

-- who is expected at a meeting: everyone active who had joined, or only that year's board
create or replace function meeting_expects(p_meeting uuid, p_member uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from meetings mt join members m on m.id=p_member
    where mt.id=p_meeting and m.deleted_at is null and (m.joined_on is null or m.joined_on<=mt.meeting_date)
      and (m.status='active' or exists(select 1 from meeting_attendance a where a.meeting_id=mt.id and a.member_id=m.id))
      and (mt.audience='all' or m.id in (select board_member_ids(club_year(mt.meeting_date))))) $$;
revoke execute on function meeting_expects(uuid,uuid) from public, anon;
grant execute on function meeting_expects(uuid,uuid) to authenticated;

create or replace function meeting_people(p_meeting uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not (perm('meetings') or perm('members')) then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(m.id) from members m where meeting_expects(p_meeting,m.id)),'[]'); end $$;
grant execute on function meeting_people(uuid) to authenticated; revoke execute on function meeting_people(uuid) from public, anon;

create table if not exists meeting_changes(
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings on delete cascade,
  kind text not null check (kind in ('prepone','postpone','time')),
  from_date date not null, from_start time, to_date date not null, to_start time, reason text, notified int not null default 0,
  changed_by uuid default auth.uid(), changed_at timestamptz not null default now());
alter table meeting_changes enable row level security;
drop policy if exists "meeting changes read" on meeting_changes;
create policy "meeting changes read" on meeting_changes for select using (perm('meetings') or perm('members'));
grant select on meeting_changes to authenticated;

-- move a scheduled meeting earlier or later; tells the members on WhatsApp (and email) when asked
create or replace function reschedule_meeting(p_meeting uuid, p_date date, p_start time, p_end time, p_reason text, p_notify boolean default true) returns jsonb
language plpgsql security definer set search_path=public as $$
declare mt meetings; k text; ch uuid; n int := 0; club text; when_txt text; begin
  if not perm('meetings') then raise exception 'Not allowed'; end if;
  select * into mt from meetings where id=p_meeting and deleted_at is null;
  if mt.id is null then raise exception 'Meeting not found'; end if;
  if mt.status<>'scheduled' then raise exception 'Only a scheduled meeting can be moved'; end if;
  if p_date is null then raise exception 'Choose the new date'; end if;
  if p_date < ist_today() then raise exception 'The new date is in the past'; end if;
  if p_date=mt.meeting_date and p_start is not distinct from mt.start_time then raise exception 'That is the same date and time'; end if;
  k := case when (p_date+coalesce(p_start,'00:00'))<(mt.meeting_date+coalesce(mt.start_time,'00:00')) then 'prepone'
            when p_date=mt.meeting_date then 'time' else 'postpone' end;
  insert into meeting_changes(meeting_id,kind,from_date,from_start,to_date,to_start,reason) values(mt.id,k,mt.meeting_date,mt.start_time,p_date,p_start,nullif(trim(p_reason),'')) returning id into ch;
  update meetings set meeting_date=p_date, start_time=p_start, end_time=coalesce(p_end,end_time),
    original_date=coalesce(original_date,mt.meeting_date), original_start=coalesce(original_start,mt.start_time), reschedules=reschedules+1 where id=mt.id;
  if p_notify then
    select club_name into club from settings where id=1;
    when_txt := to_char(p_date,'DD Mon YYYY')||coalesce(', '||to_char(p_start,'HH12:MI AM'),'');
    insert into wa_outbox(kind,ref,phone,name,member_id,body,send_after)
      select 'meeting_change',ch::text,m.phone,m.full_name,m.id,
        'Hello '||m.full_name||', '||mt.title||' is '||case k when 'prepone' then 'brought forward' when 'postpone' then 'postponed' else 'moved' end||
        ' to '||when_txt||coalesce(' at '||nullif(mt.venue,''),'')||'.'||coalesce(' Reason: '||nullif(trim(p_reason),'')||'.','')||' - '||coalesce(club,''),
        wa_next_slot(now())
      from members m where meeting_expects(mt.id,m.id) and m.phone ~ '^[6-9][0-9]{9}$' and not exists(select 1 from wa_optout o where o.phone=m.phone and o.active)
      on conflict do nothing;
    get diagnostics n=row_count;
    perform email_to_members(mt.id,'meeting_change',ch::text,jsonb_build_object('meeting',mt.title,'change',case k when 'prepone' then 'brought forward' when 'postpone' then 'postponed' else 'moved' end,
      'when',when_txt,'venue',coalesce(mt.venue,''),'reason',coalesce(nullif(trim(p_reason),''),'')));
    update meeting_changes set notified=n where id=ch;
  end if;
  return jsonb_build_object('kind',k,'notified',n); end $$;

-- a meeting on the same date every month, for 12 months (shorter months use their last day)
create or replace function create_meeting_series(p_meeting jsonb, p_day int, p_months int default 12) returns jsonb language plpgsql security definer set search_path=public as $$
declare s uuid := gen_random_uuid(); first date := (p_meeting->>'meeting_date')::date; i int; d date; n int := 0; m0 date; begin
  if not perm('meetings') then raise exception 'Not allowed'; end if;
  if p_day is null or p_day<1 or p_day>31 then raise exception 'Choose a day of the month from 1 to 31'; end if;
  if p_months<1 or p_months>24 then raise exception 'Repeat for 1 to 24 months'; end if;
  m0 := date_trunc('month',first)::date;
  for i in 0..p_months loop                       -- one extra month when the day has already passed in the first month
    exit when n >= p_months;
    d := least((m0 + (i||' months')::interval)::date + (p_day-1), ((m0 + ((i+1)||' months')::interval)::date - 1));
    if d < first then continue; end if;
    insert into meetings(kind,kind_other,title,meeting_date,start_time,end_time,venue,mode,online_link,chaired_by,minutes_by,agenda,audience,status,series_id)
    values(coalesce(p_meeting->>'kind','Monthly'),nullif(p_meeting->>'kind_other',''),p_meeting->>'title',d,nullif(p_meeting->>'start_time','')::time,nullif(p_meeting->>'end_time','')::time,
      nullif(p_meeting->>'venue',''),coalesce(nullif(p_meeting->>'mode',''),'In person'),nullif(p_meeting->>'online_link',''),nullif(p_meeting->>'chaired_by',''),nullif(p_meeting->>'minutes_by',''),
      nullif(p_meeting->>'agenda',''),coalesce(nullif(p_meeting->>'audience',''),'all'),'scheduled',s);
    n := n+1; end loop;
  return jsonb_build_object('series',s,'created',n); end $$;
grant execute on function reschedule_meeting(uuid,date,time,time,text,boolean), create_meeting_series(jsonb,int,int) to authenticated;
revoke execute on function reschedule_meeting(uuid,date,time,time,text,boolean), create_meeting_series(jsonb,int,int) from public, anon;

-- self check-in records how many minutes late
create or replace function member_checkin(p_meeting uuid, p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare m members := my_member(); mt meetings; now_ist timestamp := (now() at time zone 'Asia/Kolkata'); st text; cur text; mins int; begin
  if m.id is null then raise exception 'Your login is not linked to a member record'; end if;
  if p_meeting is null then select * into mt from meetings where deleted_at is null and status<>'cancelled' and meeting_date=now_ist::date and checkin_code=trim(p_code) limit 1;
  else select * into mt from meetings where id=p_meeting and deleted_at is null; end if;
  if mt.id is null then raise exception 'No meeting today matches this code'; end if;
  if mt.status='cancelled' then raise exception 'This meeting was cancelled'; end if;
  if mt.checkin_code is distinct from trim(coalesce(p_code,'')) then raise exception 'Wrong check-in code. Ask the secretary for today''s code.'; end if;
  if mt.meeting_date<>now_ist::date then raise exception 'Check-in is open only on the meeting day (%)', to_char(mt.meeting_date,'DD Mon YYYY'); end if;
  if not meeting_expects(mt.id,m.id) then raise exception 'This meeting is for the board members of the year'; end if;
  if mt.start_time is not null and now_ist < (mt.meeting_date + mt.start_time - interval '60 minutes') then
    raise exception 'Check-in opens one hour before the meeting (% )', to_char(mt.start_time,'HH24:MI'); end if;
  if mt.end_time is not null and now_ist > (mt.meeting_date + mt.end_time + interval '60 minutes') then raise exception 'Check-in for this meeting has closed'; end if;
  select status into cur from meeting_attendance where meeting_id=mt.id and member_id=m.id;
  if cur in ('present','late') then return jsonb_build_object('status',cur,'title',mt.title,'already',true); end if;
  mins := case when mt.start_time is null then 0 else greatest(0,floor(extract(epoch from now_ist-(mt.meeting_date+mt.start_time))/60))::int end;
  st := case when mins>15 then 'late' else 'present' end;
  insert into meeting_attendance(meeting_id,member_id,status,late_minutes,self_marked,noted_at) values(mt.id,m.id,st,case when st='late' then mins end,true,now())
    on conflict (meeting_id,member_id) do update set status=excluded.status, late_minutes=excluded.late_minutes, self_marked=true, noted_at=now(), note=null;
  return jsonb_build_object('status',st,'title',mt.title,'late_minutes',case when st='late' then mins end,'already',false); end $$;

-- ======================= camps: types and member attendance =======================
alter table camps add column if not exists camp_type text not null default 'Blood donation';
alter table camps drop constraint if exists camps_camp_type_check;
alter table camps add constraint camps_camp_type_check check (camp_type in ('Blood donation','Eye checking','Food donation','Environment (plantation)','Cancer awareness','Others'));
alter table camps add column if not exists camp_type_other text;
alter table camps add column if not exists cancer_types text[];
alter table camps add column if not exists beneficiaries int;
alter table camps add column if not exists about text;
alter table camps drop constraint if exists camps_beneficiaries_ok;
alter table camps add constraint camps_beneficiaries_ok check (beneficiaries is null or beneficiaries>=0);

create table if not exists camp_attendance(
  camp_id uuid not null references camps on delete cascade,
  member_id uuid not null references members on delete cascade,
  status text not null default 'present' check (status in ('present','late','leave','absent')),
  late_minutes int check (late_minutes is null or late_minutes between 0 and 600),
  duty text, noted_at timestamptz not null default now(), primary key(camp_id,member_id));
alter table camp_attendance enable row level security;
drop policy if exists "camp attendance manage" on camp_attendance;
create policy "camp attendance manage" on camp_attendance for all using (perm('camps') or perm('planning') or perm('members')) with check (perm('camps') or perm('planning') or perm('members'));
grant select, insert, update, delete on camp_attendance to authenticated;
create or replace trigger audit_camp_attendance after insert or update or delete on camp_attendance for each row execute function audit_row();
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='camp_attendance') then
    alter publication supabase_realtime add table camp_attendance; end if;
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='meeting_changes') then
    alter publication supabase_realtime add table meeting_changes; end if; end $$;

-- ======================= attendance report (meetings + camps) =======================
-- held = meetings the member was expected at; present counts late too; absent = expected but not present or on leave
create or replace function attendance_summary(p_from date, p_to date) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not (perm('meetings') or perm('members')) then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'meetings',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'no',m.meeting_no,'kind',case when m.kind='Others' then coalesce(m.kind_other,'Others') else m.kind end,'audience',m.audience,
        'title',m.title,'date',m.meeting_date,'guests',m.guests,
        'expected',(select count(*) from members x where meeting_expects(m.id,x.id)),
        'present',(select count(*) from meeting_attendance a where a.meeting_id=m.id and a.status in ('present','late')),
        'late',(select count(*) from meeting_attendance a where a.meeting_id=m.id and a.status='late'),
        'late_minutes',(select coalesce(sum(a.late_minutes),0) from meeting_attendance a where a.meeting_id=m.id and a.status='late'),
        'leave',(select count(*) from meeting_attendance a where a.meeting_id=m.id and a.status='leave')) order by m.meeting_date)
      from meetings m where m.status='held' and m.deleted_at is null and m.meeting_date between p_from and p_to),'[]'::jsonb),
    'camps',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'type',case when c.camp_type='Others' then coalesce(c.camp_type_other,'Others') else c.camp_type end,'date',c.camp_date,
        'present',(select count(*) from camp_attendance a where a.camp_id=c.id and a.status in ('present','late')),
        'late',(select count(*) from camp_attendance a where a.camp_id=c.id and a.status='late'),
        'leave',(select count(*) from camp_attendance a where a.camp_id=c.id and a.status='leave'),
        'marked',(select count(*) from camp_attendance a where a.camp_id=c.id)) order by c.camp_date)
      from camps c where c.deleted_at is null and c.camp_date between p_from and least(p_to,ist_today())),'[]'::jsonb),
    'members',coalesce((select jsonb_agg(x order by x->>'name') from (select jsonb_build_object('id',mb.id,'no',mb.member_no,'name',mb.full_name,'position',mb.position,
        'held',count(mt.id),
        'present',count(mt.id) filter (where a.status in ('present','late')),
        'late',count(mt.id) filter (where a.status='late'),
        'late_minutes',coalesce(sum(a.late_minutes) filter (where a.status='late'),0),
        'leave',count(mt.id) filter (where a.status='leave'),
        'absent',count(mt.id) filter (where a.status is null or a.status='absent'),
        'camps',(select count(*) from camps c where c.deleted_at is null and c.camp_date between greatest(p_from,coalesce(mb.joined_on,p_from)) and least(p_to,ist_today())),
        'camps_present',(select count(*) from camp_attendance ca join camps c on c.id=ca.camp_id where ca.member_id=mb.id and ca.status in ('present','late') and c.deleted_at is null and c.camp_date between p_from and p_to),
        'camps_late',(select count(*) from camp_attendance ca join camps c on c.id=ca.camp_id where ca.member_id=mb.id and ca.status='late' and c.deleted_at is null and c.camp_date between p_from and p_to)) x
      from members mb
      left join meetings mt on mt.status='held' and mt.deleted_at is null and mt.meeting_date between p_from and p_to and meeting_expects(mt.id,mb.id)
      left join meeting_attendance a on a.meeting_id=mt.id and a.member_id=mb.id
      where mb.deleted_at is null and mb.status='active'
      group by mb.id) s),'[]'::jsonb));
end $$;

create or replace function member_profile(p_member uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare m members; begin
  if not (perm('members') or perm('meetings')) then raise exception 'Not allowed'; end if;
  select * into m from members where id=p_member;
  return jsonb_build_object(
    'dues',coalesce((select jsonb_agg(to_jsonb(d) order by d.paid_on desc) from member_dues d where d.member_id=p_member and perm('members')),'[]'::jsonb),
    'meetings',coalesce((select jsonb_agg(jsonb_build_object('no',mt.meeting_no,'date',mt.meeting_date,'kind',mt.kind,'title',mt.title,'status',coalesce(a.status,'absent'),'late_minutes',a.late_minutes) order by mt.meeting_date desc)
      from meetings mt left join meeting_attendance a on a.meeting_id=mt.id and a.member_id=p_member
      where mt.status='held' and mt.deleted_at is null and meeting_expects(mt.id,p_member)),'[]'::jsonb),
    'camps',coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'type',c.camp_type,'date',c.camp_date,'status',ca.status,'late_minutes',ca.late_minutes) order by c.camp_date desc)
      from camp_attendance ca join camps c on c.id=ca.camp_id where ca.member_id=p_member and c.deleted_at is null),'[]'::jsonb),
    'actions',coalesce((select jsonb_agg(jsonb_build_object('task',x.task,'due',x.due,'done',x.done,'meeting_no',mt.meeting_no) order by x.done, x.due nulls last)
      from meeting_actions x join meetings mt on mt.id=x.meeting_id where x.owner_member=p_member),'[]'::jsonb),
    'donations',case when m.donor_id is null then null else (select count(*) from donations n join registrations r on r.id=n.registration_id where r.donor_id=m.donor_id)
      +(select coalesce(sum(coalesce(units,1)),0) from donor_events where donor_id=m.donor_id and kind in ('outside_donation','emergency_donation')) end,
    'donor_no',(select donor_no from donors where id=m.donor_id),
    'subscription',(select jsonb_build_object('year',club_year(ist_today()),'fee',s.member_subscription,
        'paid',coalesce((select sum(coalesce(d.subscription,d.amount)) from member_dues d where d.member_id=p_member and d.period=club_year(ist_today())),0),
        'donated',coalesce((select sum(d.donation) from member_dues d where d.member_id=p_member and d.period=club_year(ist_today())),0)) from settings s where s.id=1));
end $$;

-- the member's own page counts only the meetings they were expected at
do $$ declare src text; begin
  select pg_get_functiondef('public.my_club()'::regprocedure) into src;
  src := replace(src,'where mt.status=''held'' and mt.deleted_at is null and mt.meeting_date between greatest(ry_from,coalesce(m.joined_on,ry_from)) and ry_to),',
                     'where mt.status=''held'' and mt.deleted_at is null and mt.meeting_date between greatest(ry_from,coalesce(m.joined_on,ry_from)) and ry_to and meeting_expects(mt.id,m.id)),');
  src := replace(src,'where mt.deleted_at is null and mt.status=''scheduled'' and mt.meeting_date>=(now() at time zone ''Asia/Kolkata'')::date),',
                     'where mt.deleted_at is null and mt.status=''scheduled'' and mt.meeting_date>=(now() at time zone ''Asia/Kolkata'')::date and meeting_expects(mt.id,m.id)),');
  src := replace(src,'where mt.deleted_at is null and mt.status=''held'' order by mt.meeting_date desc limit 12) s)',
                     'where mt.deleted_at is null and mt.status=''held'' and meeting_expects(mt.id,m.id) order by mt.meeting_date desc limit 12) s)');
  execute src; end $$;

-- ======================= subscription and donation =======================
alter table member_dues add column if not exists subscription numeric(10,2);
alter table member_dues add column if not exists donation numeric(10,2) not null default 0;
update member_dues set subscription=amount where subscription is null;
alter table member_dues drop constraint if exists member_dues_parts_ok;
alter table member_dues add constraint member_dues_parts_ok check (coalesce(subscription,0)>=0 and donation>=0);

create table if not exists app_alerts(
  id uuid primary key default gen_random_uuid(),
  kind text not null, title text not null, body text, link text, ref text,
  created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid);
alter table app_alerts enable row level security;
drop policy if exists "alerts read" on app_alerts;
create policy "alerts read" on app_alerts for select using (perm('settings') or perm('members') or perm('messages') or perm('funds'));
drop policy if exists "alerts resolve" on app_alerts;
create policy "alerts resolve" on app_alerts for update using (perm('settings') or perm('members') or perm('messages') or perm('funds')) with check (true);
grant select, update on app_alerts to authenticated;
create index if not exists app_alerts_open on app_alerts(created_at desc) where resolved_at is null;
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='app_alerts') then
  alter publication supabase_realtime add table app_alerts; end if; end $$;

-- amount is always subscription + donation; old screens that send only an amount still work
create or replace function member_dues_parts() returns trigger language plpgsql set search_path=public as $$
begin
  if new.subscription is null then new.subscription := new.amount - coalesce(new.donation,0); end if;
  new.donation := coalesce(new.donation,0);
  new.amount := new.subscription + new.donation;
  if new.amount<=0 then raise exception 'Enter the subscription or the donation amount'; end if;
  if coalesce(new.period,'')='' then new.period := club_year(coalesce(new.paid_on,ist_today())); end if;
  return new; end $$;
drop trigger if exists member_dues_parts on member_dues;
create trigger member_dues_parts before insert or update on member_dues for each row execute function member_dues_parts();

-- a payment that takes the subscription for the year above the yearly fee raises an alert (bell + email)
create or replace function member_dues_check() returns trigger language plpgsql security definer set search_path=public as $$
declare fee numeric; paid numeric; m members; begin
  select member_subscription into fee from settings where id=1;
  if coalesce(fee,0)<=0 then return new; end if;
  select coalesce(sum(subscription),0) into paid from member_dues where member_id=new.member_id and period=new.period;
  if paid>fee then
    select * into m from members where id=new.member_id;
    perform staff_alert('over_subscription',
      'Subscription paid above the yearly fee: '||m.full_name,
      m.full_name||' (M-'||lpad(m.member_no::text,3,'0')||') has paid Rs. '||to_char(paid,'FM99,99,99,990')||' as subscription for '||new.period||
        ', above the yearly fee of Rs. '||to_char(fee,'FM99,99,99,990')||'. Extra: Rs. '||to_char(paid-fee,'FM99,99,99,990')||'. Move the extra to donation if it was a donation.',
      '/members','dues:'||new.id);
  end if;
  return new; end $$;
drop trigger if exists member_dues_check on member_dues;
create trigger member_dues_check after insert or update of subscription, period on member_dues for each row execute function member_dues_check();

-- ======================= email =======================
create table if not exists email_settings(
  id int primary key default 1 check (id=1),
  provider text not null default 'off' check (provider in ('off','resend','sendgrid')),
  from_email text, from_name text, reply_to text,
  alert_emails text,                                   -- comma separated: who gets staff alerts and the morning report
  auto jsonb not null default '{"birthday":true,"camp_reminder":true,"certificate":true,"emergency":false,"meeting_change":true,"staff_alerts":true,"daily_report":true}',
  per_run int not null default 40 check (per_run between 1 and 200),
  last_run_at timestamptz, last_status jsonb, updated_at timestamptz default now());
insert into email_settings(id) values(1) on conflict do nothing;
alter table email_settings enable row level security;
drop policy if exists "email settings read" on email_settings;
create policy "email settings read" on email_settings for select using (perm('settings') or perm('messages'));
drop policy if exists "email settings write" on email_settings;
create policy "email settings write" on email_settings for update using (perm('settings')) with check (perm('settings'));
grant select, update on email_settings to authenticated;
create or replace trigger audit_email_settings after insert or update or delete on email_settings for each row execute function audit_row();

-- API keys typed into Settings: never readable from the app, only by the email sender
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.email_keys(provider text primary key, api_key text not null, updated_at timestamptz not null default now());
create table if not exists private.config(k text primary key, v text not null);
insert into private.config(k,v) values('cron_secret',replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','')) on conflict do nothing;

create or replace function set_email_key(p_provider text, p_key text) returns jsonb language plpgsql security definer set search_path=public,private as $$
begin
  if not perm('settings') then raise exception 'Only people with the Settings permission can do this'; end if;
  if p_provider not in ('resend','sendgrid') then raise exception 'Unknown provider'; end if;
  if coalesce(trim(p_key),'')='' then delete from private.email_keys where provider=p_provider; return jsonb_build_object('saved',false); end if;
  if p_provider='resend' and trim(p_key) !~ '^re_[A-Za-z0-9_]{10,}$' then raise exception 'A Resend key starts with re_'; end if;
  if p_provider='sendgrid' and trim(p_key) !~ '^SG\.[A-Za-z0-9_.-]{20,}$' then raise exception 'A SendGrid key starts with SG.'; end if;
  insert into private.email_keys(provider,api_key) values(p_provider,trim(p_key)) on conflict (provider) do update set api_key=excluded.api_key, updated_at=now();
  return jsonb_build_object('saved',true); end $$;
create or replace function email_keys_present() returns jsonb language sql stable security definer set search_path=public,private as $$
  select jsonb_build_object('resend',exists(select 1 from private.email_keys where provider='resend'),'sendgrid',exists(select 1 from private.email_keys where provider='sendgrid'),
    'resend_last4',(select right(api_key,4) from private.email_keys where provider='resend'),'sendgrid_last4',(select right(api_key,4) from private.email_keys where provider='sendgrid')) $$;
grant execute on function set_email_key(text,text), email_keys_present() to authenticated;
revoke execute on function set_email_key(text,text), email_keys_present() from public, anon;
-- for the email sender (service role) only
create or replace function email_key(p_provider text) returns text language sql stable security definer set search_path=public,private as $$
  select api_key from private.email_keys where provider=p_provider $$;
create or replace function check_cron_secret(p text) returns boolean language sql stable security definer set search_path=public,private as $$
  select exists(select 1 from private.config where k='cron_secret' and v=p) $$;
revoke execute on function email_key(text), check_cron_secret(text) from public, anon, authenticated;

create table if not exists email_templates(
  kind text primary key, name text not null, subject text not null, html text not null, updated_at timestamptz default now());
alter table email_templates enable row level security;
drop policy if exists "email templates read" on email_templates;
create policy "email templates read" on email_templates for select using (perm('settings') or perm('messages'));
drop policy if exists "email templates write" on email_templates;
create policy "email templates write" on email_templates for all using (perm('settings')) with check (perm('settings'));
grant select, insert, update on email_templates to authenticated;
create or replace trigger audit_email_templates after insert or update or delete on email_templates for each row execute function audit_row();

-- one shared look; {content} is the body of each template
create or replace function email_frame(p_title text, p_content text) returns text language sql stable security definer set search_path=public as $$
  select '<!doctype html><html><body style="margin:0;background:#F1F4F9;font-family:Segoe UI,Arial,sans-serif;color:#1B2433">'||
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F4F9;padding:24px 12px"><tr><td align="center">'||
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E3E8F0">'||
    '<tr><td style="background:'||coalesce(s.brand_color,'#0EA5A4')||';padding:20px 24px;color:#ffffff">'||
      case when coalesce(s.logo_url,'')<>'' then '<img src="'||s.logo_url||'" alt="" height="40" style="height:40px;vertical-align:middle;border-radius:8px;margin-right:10px">' else '' end||
      '<span style="font-size:18px;font-weight:700;vertical-align:middle">'||coalesce(s.club_name,'')||'</span></td></tr>'||
    '<tr><td style="padding:28px 24px 8px"><h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0B1324">'||p_title||'</h1>'||p_content||'</td></tr>'||
    '<tr><td style="padding:18px 24px 26px;font-size:12px;color:#7A869C;border-top:1px solid #EEF1F6">'||coalesce(s.club_name,'')||
      coalesce(' · '||nullif(s.contact_phone,''),'')||coalesce(' · '||nullif(s.contact_email,''),'')||
      '<br>You get this email because you are a donor or member of the club. Reply STOP to stop emails.</td></tr>'||
    '</table></td></tr></table></body></html>'
  from settings s where s.id=1 $$;

insert into email_templates(kind,name,subject,html) values
 ('birthday','Birthday wish','Happy Birthday, {name}! 🎂',
  '<p style="font-size:16px;line-height:1.6">Dear {name},</p><p style="font-size:16px;line-height:1.6">Everyone at <b>{club}</b> wishes you a very happy birthday! Thank you for being part of our family of life-savers. May the year ahead bring you good health and happiness.</p><p style="font-size:16px;line-height:1.6">இனிய பிறந்தநாள் வாழ்த்துகள்!</p>'),
 ('camp_reminder','Camp reminder (day before)','Reminder: {camp} is tomorrow',
  '<p style="font-size:16px;line-height:1.6">Dear {name},</p><p style="font-size:16px;line-height:1.6">This is a reminder that <b>{camp}</b> is tomorrow, <b>{date}</b>, at <b>{venue}</b>. Your time slot: <b>{slot}</b>.</p><p style="font-size:15px;line-height:1.6;color:#3A4558">Please eat a good meal, drink plenty of water, sleep well tonight and bring a photo ID.</p>'),
 ('certificate','Thank-you with certificate','Thank you for donating blood, {name} 🩸',
  '<p style="font-size:16px;line-height:1.6">Dear {name},</p><p style="font-size:16px;line-height:1.6">Thank you for donating blood at <b>{camp}</b>. Your gift can save up to three lives. Please drink plenty of water today and rest well.</p><p style="margin:22px 0"><a href="{link}" style="background:#E11D48;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;display:inline-block">Download your certificate</a></p>'),
 ('emergency','Emergency blood need','URGENT: {group} blood needed at {hospital}',
  '<p style="font-size:16px;line-height:1.6">Dear {name},</p><p style="font-size:16px;line-height:1.6"><b style="color:#E11D48">{group}</b> blood is urgently needed at <b>{hospital}</b>.</p><p style="font-size:16px;line-height:1.6">If you are eligible and can donate today, please call <b>{contact}</b>.</p>'),
 ('meeting_change','Meeting moved','{meeting} is {change} to {when}',
  '<p style="font-size:16px;line-height:1.6">Dear {name},</p><p style="font-size:16px;line-height:1.6"><b>{meeting}</b> is {change} to <b>{when}</b>{venue_at}.</p><p style="font-size:15px;line-height:1.6;color:#3A4558">{reason}</p>'),
 ('staff_alert','Alert for the team','[{club}] {title}',
  '<p style="font-size:16px;line-height:1.6">{body}</p><p style="margin:22px 0"><a href="{link}" style="background:#0EA5A4;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:700;display:inline-block">Open the CRM</a></p>'),
 ('daily_report','Morning report','{club} · today, {date}',
  '<p style="font-size:15px;line-height:1.6;color:#3A4558">Good morning! Here is the day at a glance.</p>{report}<p style="margin:22px 0"><a href="{link}" style="background:#0EA5A4;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:700;display:inline-block">Open the CRM</a></p>')
on conflict (kind) do nothing;

create table if not exists email_outbox(
  id uuid primary key default gen_random_uuid(),
  kind text not null, ref text, to_email text not null check (to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'), to_name text,
  subject text not null, html text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','cancelled')),
  attempts int not null default 0, error text, provider text, provider_id text,
  send_after timestamptz not null default now(), claimed_at timestamptz, created_at timestamptz not null default now(), sent_at timestamptz);
create unique index if not exists email_outbox_once on email_outbox(kind, ref, lower(to_email)) where ref is not null;
create index if not exists email_outbox_queue on email_outbox(status, send_after);
alter table email_outbox enable row level security;
drop policy if exists "email outbox read" on email_outbox;
create policy "email outbox read" on email_outbox for select using (perm('messages') or perm('settings'));
grant select on email_outbox to authenticated;
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='email_outbox') then
  alter publication supabase_realtime add table email_outbox; end if; end $$;

create table if not exists email_optout(email text primary key, created_at timestamptz not null default now());
alter table email_optout enable row level security;
drop policy if exists "email optout manage" on email_optout;
create policy "email optout manage" on email_optout for all using (perm('messages')) with check (perm('messages'));
grant select, insert, delete on email_optout to authenticated;

-- fill {words} with safe (escaped) values
create or replace function email_fill(p text, v jsonb) returns text language plpgsql immutable set search_path=public as $$
declare k text; out text := p; val text; begin
  for k in select jsonb_object_keys(v) loop
    val := coalesce(v->>k,'');
    if k not in ('report','link') then val := replace(replace(replace(replace(val,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'); end if;
    out := replace(out,'{'||k||'}',val); end loop;
  return regexp_replace(out,'\{[a-z_]+\}','','g'); end $$;

-- queue one email from a template (skips people who stopped emails and duplicates)
create or replace function email_queue(p_kind text, p_ref text, p_to text, p_name text, v jsonb, p_send_after timestamptz default null) returns boolean
language plpgsql security definer set search_path=public as $$
declare t email_templates; s settings; e email_settings; vars jsonb; begin
  select * into e from email_settings where id=1;
  if e.provider='off' or p_to is null or p_to !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return false; end if;
  if exists(select 1 from email_optout where email=lower(trim(p_to))) and p_kind not in ('staff_alert','daily_report') then return false; end if;
  select * into t from email_templates where kind=p_kind; if t.kind is null then return false; end if;
  select * into s from settings where id=1;
  vars := jsonb_build_object('club',s.club_name,'name',coalesce(nullif(p_name,''),'Friend'))||coalesce(v,'{}');
  insert into email_outbox(kind,ref,to_email,to_name,subject,html,send_after)
    values(p_kind,p_ref,lower(trim(p_to)),p_name,left(email_fill(t.subject,vars),300),email_frame(email_fill(t.subject,vars),email_fill(t.html,vars)),coalesce(p_send_after,now()))
    on conflict do nothing;
  return found; end $$;
revoke execute on function email_queue(text,text,text,text,jsonb,timestamptz) from public, anon, authenticated;

create or replace function email_to_members(p_meeting uuid, p_kind text, p_ref text, v jsonb) returns int language plpgsql security definer set search_path=public as $$
declare n int := 0; m members; e email_settings; begin
  select * into e from email_settings where id=1;
  if e.provider='off' or not coalesce((e.auto->>p_kind)::boolean,false) then return 0; end if;
  for m in select x.* from members x where meeting_expects(p_meeting,x.id) and x.email is not null loop
    if email_queue(p_kind,p_ref,m.email,m.full_name,v||jsonb_build_object('venue_at',case when coalesce(v->>'venue','')<>'' then ' at '||(v->>'venue') else '' end,
      'reason',case when coalesce(v->>'reason','')<>'' then 'Reason: '||(v->>'reason') else '' end)) then n:=n+1; end if; end loop;
  return n; end $$;
revoke execute on function email_to_members(uuid,text,text,jsonb) from public, anon, authenticated;

-- staff alert: a bell item for the team, and an email to the alert addresses
create or replace function staff_alert(p_kind text, p_title text, p_body text, p_link text default '/', p_ref text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare a uuid; e email_settings; addr text; site text; begin
  if p_ref is not null and exists(select 1 from app_alerts where kind=p_kind and ref=p_ref) then return null; end if;
  insert into app_alerts(kind,title,body,link,ref) values(p_kind,p_title,p_body,p_link,p_ref) returning id into a;
  select * into e from email_settings where id=1; select coalesce(nullif(site_url,''),'') into site from wa_settings where id=1;
  if e.provider<>'off' and coalesce((e.auto->>'staff_alerts')::boolean,true) then
    for addr in select trim(x) from unnest(string_to_array(coalesce(e.alert_emails,''),',')) x where trim(x)<>'' loop
      perform email_queue('staff_alert',a::text,addr,'',jsonb_build_object('title',p_title,'body',p_body,'link',site||'#'||coalesce(p_link,'/'))); end loop; end if;
  return a; end $$;
revoke execute on function staff_alert(text,text,text,text,text) from public, anon, authenticated;

create or replace function resolve_alert(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not (perm('settings') or perm('members') or perm('messages') or perm('funds')) then raise exception 'Not allowed'; end if;
  update app_alerts set resolved_at=now(), resolved_by=auth.uid() where id=p_id and resolved_at is null; end $$;
grant execute on function resolve_alert(uuid) to authenticated; revoke execute on function resolve_alert(uuid) from public, anon;

-- the email sender (edge function, service role) takes a batch and reports back
create or replace function email_claim(p_limit int default 40) returns setof email_outbox language plpgsql security definer set search_path=public as $$
begin
  update email_outbox set status='queued' where status='sending' and claimed_at<now()-interval '10 minutes';
  return query update email_outbox o set status='sending', attempts=o.attempts+1, claimed_at=now(), provider=(select provider from email_settings where id=1)
    where o.id in (select id from email_outbox where status='queued' and send_after<=now() order by send_after, created_at limit p_limit for update skip locked) returning o.*; end $$;
create or replace function email_result(p_id uuid, p_ok boolean, p_error text default null, p_provider_id text default null) returns void language plpgsql security definer set search_path=public as $$
begin
  update email_outbox set status=case when p_ok then 'sent' when attempts<3 and coalesce(p_error,'') ilike 'retry:%' then 'queued' else 'failed' end,
    error=case when p_ok then null else left(p_error,400) end, provider_id=p_provider_id, sent_at=case when p_ok then now() end,
    send_after=case when not p_ok then now()+interval '10 minutes' else send_after end where id=p_id; end $$;
create or replace function email_run_status(p jsonb) returns void language plpgsql security definer set search_path=public as $$
begin perform set_config('app.reverting','1',true); update email_settings set last_run_at=now(), last_status=p where id=1; perform set_config('app.reverting','',true); end $$;
revoke execute on function email_claim(int), email_result(uuid,boolean,text,text), email_run_status(jsonb) from public, anon, authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  grant usage on schema private to service_role;
  grant execute on function email_claim(int), email_result(uuid,boolean,text,text), email_run_status(jsonb), email_key(text), check_cron_secret(text) to service_role; end if; end $$;

create or replace function email_cancel(p_ids uuid[]) returns int language plpgsql security definer set search_path=public as $$
declare n int; begin if not perm('messages') then raise exception 'Not allowed'; end if;
  update email_outbox set status='cancelled' where status in ('queued','failed') and id=any(p_ids); get diagnostics n=row_count; return n; end $$;
create or replace function email_retry(p_ids uuid[]) returns int language plpgsql security definer set search_path=public as $$
declare n int; begin if not perm('messages') then raise exception 'Not allowed'; end if;
  update email_outbox set status='queued', error=null, send_after=now(), attempts=0 where status in ('failed','cancelled') and id=any(p_ids); get diagnostics n=row_count; return n; end $$;
-- a test email from Settings
create or replace function email_test(p_to text) returns jsonb language plpgsql security definer set search_path=public as $$
declare ok boolean; begin
  if not perm('settings') then raise exception 'Only people with the Settings permission can do this'; end if;
  if (select provider from email_settings where id=1)='off' then raise exception 'Choose Resend or SendGrid first'; end if;
  ok := email_queue('staff_alert','test-'||extract(epoch from clock_timestamp())::bigint,p_to,'',jsonb_build_object('title','Test email from the CRM',
    'body','If you can read this, email from the CRM works. Birthday wishes, reminders, certificates and alerts can now go out by email too.','link',''));
  return jsonb_build_object('queued',ok); end $$;
grant execute on function email_cancel(uuid[]), email_retry(uuid[]), email_test(text) to authenticated;
revoke execute on function email_cancel(uuid[]), email_retry(uuid[]), email_test(text) from public, anon;

-- ======================= daily messages at the chosen time =======================
alter table wa_settings add column if not exists send_at time not null default '08:00';
alter table wa_settings add column if not exists last_tick_day date;
alter table wa_settings add column if not exists last_check_day date;
alter table wa_settings drop constraint if exists wa_settings_send_at_ok;
alter table wa_settings add constraint wa_settings_send_at_ok check (send_at between '05:00' and '21:00');
update wa_settings set auto=auto||'{"member_birthday":true}' where not (auto ? 'member_birthday');

create or replace function wa_daily_rules(p_day date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare w wa_settings; d date := coalesce(p_day,wa_ist_today()); club text; site text; at timestamptz; out jsonb := '{}'; n int; begin
  if auth.uid() is not null and not perm('messages') then raise exception 'Not allowed'; end if;
  select * into w from wa_settings where id=1; select club_name into club from settings where id=1;
  site := coalesce(nullif(w.site_url,''),'');
  at := wa_next_slot(greatest(now(), ((d+w.send_at) at time zone 'Asia/Kolkata')));

  if coalesce((w.auto->>'birthday')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'birthday',extract(year from d)::text,x.phone,x.full_name,x.id,wa_fill(wa_template('birthday'),v),v,at,null
    from donors x cross join lateral (select jsonb_build_object('name',x.full_name,'club',club) v) j
    where x.deleted_at is null and x.consent and x.dob is not null and to_char(x.dob,'MM-DD')=to_char(d,'MM-DD') and x.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('birthday',n); end if;

  if coalesce((w.auto->>'member_birthday')::boolean,false) then   -- club members too (one wish per number)
    insert into wa_outbox(kind,ref,phone,name,member_id,body,vars,send_after,created_by)
    select 'birthday',extract(year from d)::text,m.phone,m.full_name,m.id,wa_fill(wa_template('birthday'),v),v,at,null
    from members m cross join lateral (select jsonb_build_object('name',m.full_name,'club',club) v) j
    where m.deleted_at is null and m.status='active' and m.dob is not null and to_char(m.dob,'MM-DD')=to_char(d,'MM-DD') and m.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=m.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('member_birthday',n); end if;

  if coalesce((w.auto->>'eligible_again')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'eligible_again',x.last_donation::text,x.phone,x.full_name,x.id,wa_fill(wa_template('eligible_again'),v),v,at,null
    from donors x cross join settings s cross join lateral (select jsonb_build_object('name',x.full_name,'club',club) v) j
    where s.id=1 and x.deleted_at is null and x.consent and x.last_donation is not null and x.phone ~ '^[6-9][0-9]{9}$'
      and x.last_donation + case when x.gender='Female' then s.gap_female else s.gap_male end between d-3 and d
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('eligible_again',n); end if;

  if coalesce((w.auto->>'reminder_1d')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'reminder_1d',c.id::text,x.phone,x.full_name,x.id,wa_fill(wa_template('reminder_1d'),v),v,at,null
    from registrations r join camps c on c.id=r.camp_id join donors x on x.id=r.donor_id
      cross join lateral (select jsonb_build_object('name',x.full_name,'club',club,'camp',c.name,'date',to_char(c.camp_date,'DD Mon YYYY'),'venue',coalesce(c.venue,'the venue'),'slot',coalesce(r.slot::text,'any time')) v) j
    where c.camp_date=d+1 and c.deleted_at is null and r.status='registered' and x.deleted_at is null and x.consent and x.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('reminder_1d',n); end if;

  if coalesce((w.auto->>'reminder_today')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'reminder_today',c.id::text,x.phone,x.full_name,x.id,wa_fill(wa_template('reminder_today'),v),v,
      wa_next_slot(greatest(now(),((d+time '07:00') at time zone 'Asia/Kolkata'))),null
    from registrations r join camps c on c.id=r.camp_id join donors x on x.id=r.donor_id
      cross join lateral (select jsonb_build_object('name',x.full_name,'club',club,'camp',c.name,'venue',coalesce(c.venue,'the venue'),'slot',coalesce(r.slot::text,'any time')) v) j
    where c.camp_date=d and c.deleted_at is null and r.status='registered' and x.deleted_at is null and x.consent and x.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('reminder_today',n); end if;

  if coalesce((w.auto->>'followup')::boolean,false) then
    insert into wa_outbox(kind,ref,phone,name,donor_id,body,vars,send_after,created_by)
    select 'followup',r.id::text,x.phone,x.full_name,x.id,wa_fill(wa_template('followup'),v),v,at,null
    from donations dn join registrations r on r.id=dn.registration_id join camps c on c.id=r.camp_id join donors x on x.id=r.donor_id
      cross join lateral (select jsonb_build_object('name',x.full_name,'club',club,'camp',c.name,
        'link',case when site<>'' and dn.verify_code is not null then site||'#/certificate/'||substr(dn.verify_code,1,4)||'-'||substr(dn.verify_code,5,4)||'-'||substr(dn.verify_code,9,4) else '' end) v) j
    where c.camp_date=d-1 and x.deleted_at is null and x.consent and x.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=x.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('followup',n); end if;

  if coalesce((w.auto->>'meeting_1d')::boolean,false) then   -- only the people the meeting is for (board meetings: that year's board)
    insert into wa_outbox(kind,ref,phone,name,member_id,body,vars,send_after,created_by)
    select 'meeting_1d',mt.id::text,m.phone,m.full_name,m.id,wa_fill(wa_template('meeting_1d'),v),v,at,null
    from meetings mt cross join members m
      cross join lateral (select jsonb_build_object('name',m.full_name,'club',club,'meeting',mt.title,'date',to_char(mt.meeting_date,'DD Mon'),
        'time',coalesce(to_char(mt.start_time,'HH12:MI AM'),''),'venue',coalesce(mt.venue,case when mt.mode='Online' then 'online' else '' end)) v) j
    where mt.meeting_date=d+1 and mt.status='scheduled' and mt.deleted_at is null and meeting_expects(mt.id,m.id) and m.phone ~ '^[6-9][0-9]{9}$'
      and not exists(select 1 from wa_optout o where o.phone=m.phone and o.active)
    on conflict do nothing; get diagnostics n=row_count; out := out||jsonb_build_object('meeting_1d',n); end if;
  perform set_config('app.reverting','1',true);
  update wa_settings set last_rules_at=now(), last_rules=out where id=1;
  perform set_config('app.reverting','',true);
  return out; end $$;

-- the same day's emails: birthdays, camp reminders, thank-you with certificate
create or replace function email_daily_rules(p_day date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare e email_settings; w wa_settings; d date := coalesce(p_day,ist_today()); at timestamptz; site text; n int := 0; r record; out jsonb := '{}'; begin
  select * into e from email_settings where id=1; select * into w from wa_settings where id=1;
  if e.provider='off' then return jsonb_build_object('email','off'); end if;
  at := greatest(now(),((d+w.send_at) at time zone 'Asia/Kolkata')); site := coalesce(nullif(w.site_url,''),'');
  if coalesce((e.auto->>'birthday')::boolean,false) then n := 0;
    for r in select full_name, email from donors where deleted_at is null and consent and email is not null and dob is not null and to_char(dob,'MM-DD')=to_char(d,'MM-DD')
             union select full_name, email from members where deleted_at is null and status='active' and email is not null and dob is not null and to_char(dob,'MM-DD')=to_char(d,'MM-DD') loop
      if email_queue('birthday',extract(year from d)::text,r.email,r.full_name,'{}',at) then n:=n+1; end if; end loop;
    out := out||jsonb_build_object('birthday',n); end if;
  if coalesce((e.auto->>'camp_reminder')::boolean,false) then n := 0;
    for r in select x.full_name, x.email, c.id cid, c.name, c.camp_date, c.venue, rg.slot from registrations rg join camps c on c.id=rg.camp_id join donors x on x.id=rg.donor_id
             where c.camp_date=d+1 and c.deleted_at is null and rg.status='registered' and x.deleted_at is null and x.consent and x.email is not null loop
      if email_queue('camp_reminder',r.cid::text,r.email,r.full_name,jsonb_build_object('camp',r.name,'date',to_char(r.camp_date,'DD Mon YYYY'),'venue',coalesce(r.venue,'the venue'),'slot',coalesce(r.slot::text,'any time')),at) then n:=n+1; end if; end loop;
    out := out||jsonb_build_object('camp_reminder',n); end if;
  if coalesce((e.auto->>'certificate')::boolean,false) and site<>'' then n := 0;
    for r in select x.full_name, x.email, rg.id rid, c.name, dn.verify_code from donations dn join registrations rg on rg.id=dn.registration_id join camps c on c.id=rg.camp_id join donors x on x.id=rg.donor_id
             where c.camp_date=d-1 and x.deleted_at is null and x.consent and x.email is not null and dn.verify_code is not null loop
      if email_queue('certificate',r.rid::text,r.email,r.full_name,jsonb_build_object('camp',r.name,'link',site||'#/certificate/'||substr(r.verify_code,1,4)||'-'||substr(r.verify_code,5,4)||'-'||substr(r.verify_code,9,4)),at) then n:=n+1; end if; end loop;
    out := out||jsonb_build_object('certificate',n); end if;
  return out; end $$;
revoke execute on function email_daily_rules(date) from public, anon, authenticated;

-- emergency requests can also go out by email (when switched on)
create or replace function email_emergency() returns trigger language plpgsql security definer set search_path=public as $$
declare e email_settings; s settings; r record; begin
  select * into e from email_settings where id=1;
  if e.provider='off' or not coalesce((e.auto->>'emergency')::boolean,false) or new.status<>'open' then return new; end if;
  select * into s from settings where id=1;
  for r in select full_name, email from donors where deleted_at is null and consent and email is not null and blood_group=new.blood_group
           and (last_donation is null or last_donation + case when gender='Female' then s.gap_female else s.gap_male end <= ist_today()) loop
    perform email_queue('emergency',new.id::text,r.email,r.full_name,jsonb_build_object('group',new.blood_group::text,'hospital',new.hospital,'contact',trim(coalesce(new.contact_name,'')||' '||coalesce(new.contact_phone,'')))); end loop;
  perform staff_alert('emergency','Emergency: '||new.blood_group::text||' blood needed at '||new.hospital,
    coalesce(new.units_needed::text,'1')||' unit(s). Contact '||trim(coalesce(new.contact_name,'')||' '||coalesce(new.contact_phone,''))||'.','/stock','emergency:'||new.id);
  return new; end $$;
drop trigger if exists email_emergency on emergency_requests;
create trigger email_emergency after insert on emergency_requests for each row execute function email_emergency();

-- ======================= morning self-check and daily tick =======================
create table if not exists health_checks(
  id uuid primary key default gen_random_uuid(), day date not null unique, ok boolean not null, issues jsonb not null default '[]', info jsonb not null default '{}', created_at timestamptz not null default now());
alter table health_checks enable row level security;
drop policy if exists "health read" on health_checks;
create policy "health read" on health_checks for select using (perm('settings') or perm('messages'));
grant select on health_checks to authenticated;

create or replace function morning_check(p_day date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare d date := coalesce(p_day,ist_today()); w wa_settings; s wa_session; e email_settings; issues jsonb := '[]'; info jsonb; bd int; mb int; stuck int; failed int; efail int; low text; site text; rep text; addr text; begin
  select * into w from wa_settings where id=1; select * into s from wa_session where id=1; select * into e from email_settings where id=1;
  select count(*) into bd from donors where deleted_at is null and consent and dob is not null and to_char(dob,'MM-DD')=to_char(d,'MM-DD');
  select count(*) into mb from members where deleted_at is null and status='active' and dob is not null and to_char(dob,'MM-DD')=to_char(d,'MM-DD');
  select count(*) into stuck from wa_outbox where status='queued' and not manual and send_after < now()-interval '1 hour';
  select count(*) into failed from wa_outbox where status='failed' and created_at > now()-interval '24 hours';
  select count(*) into efail from email_outbox where status='failed' and created_at > now()-interval '24 hours';
  if w.provider='qr' and (s.last_seen is null or s.last_seen < now()-interval '5 minutes') then
    issues := issues||jsonb_build_array('The WhatsApp sender on the server is not running (last seen '||coalesce(to_char(s.last_seen at time zone 'Asia/Kolkata','DD Mon HH12:MI AM'),'never')||'). Today''s messages will wait until it is back.'); end if;
  if w.provider='qr' and s.last_seen >= now()-interval '5 minutes' and s.status<>'connected' then
    issues := issues||jsonb_build_array('The club phone is not linked (status: '||coalesce(s.status,'unknown')||'). Scan the QR in WhatsApp and alerts → Connect.'); end if;
  if w.provider='manual' and (bd+mb)>0 then issues := issues||jsonb_build_array('WhatsApp is on "Tap to send": today''s '||(bd+mb)||' birthday wish(es) wait in the Outbox for someone to send them.'); end if;
  if stuck>0 then issues := issues||jsonb_build_array(stuck||' WhatsApp message(s) are overdue and still waiting in the Outbox.'); end if;
  if failed>0 then issues := issues||jsonb_build_array(failed||' WhatsApp message(s) failed in the last 24 hours.'); end if;
  if e.provider<>'off' and not exists(select 1 from private.email_keys where provider=e.provider) then issues := issues||jsonb_build_array('Email is set to '||e.provider||' but its API key is missing.'); end if;
  if e.provider<>'off' and coalesce(e.last_status->>'ok','true')='false' then issues := issues||jsonb_build_array('The last email run failed: '||coalesce(e.last_status->>'error','unknown error')); end if;
  if efail>0 then issues := issues||jsonb_build_array(efail||' email(s) failed in the last 24 hours.'); end if;
  select string_agg(g,', ') into low from (select unnest(enum_range(null::blood_group))::text g) x
    where (select count(*) from blood_units u where u.blood_group::text=x.g and u.status='available') < coalesce((select min_units from stock_thresholds sm where sm.blood_group::text=x.g),0);
  info := jsonb_build_object('donor_birthdays',bd,'member_birthdays',mb,'whatsapp',w.provider,'sender',coalesce(s.status,'none'),'email',e.provider,
    'camps_today',(select count(*) from camps where deleted_at is null and camp_date=d),'camps_tomorrow',(select count(*) from camps where deleted_at is null and camp_date=d+1),
    'meetings_today',(select count(*) from meetings where deleted_at is null and status='scheduled' and meeting_date=d),
    'open_emergencies',(select count(*) from emergency_requests where deleted_at is null and status='open'),'low_stock',coalesce(low,''),'send_at',to_char(w.send_at,'HH12:MI AM'));
  insert into health_checks(day,ok,issues,info) values(d,jsonb_array_length(issues)=0,issues,info)
    on conflict (day) do update set ok=excluded.ok, issues=excluded.issues, info=excluded.info, created_at=now();
  if jsonb_array_length(issues)>0 then
    perform staff_alert('morning_check','Morning check: '||jsonb_array_length(issues)||' thing(s) need attention before '||to_char(w.send_at,'HH12:MI AM'),
      (select string_agg('• '||x,E'\n') from jsonb_array_elements_text(issues) x),'/messages?tab=connect','check:'||d); end if;
  -- morning report email to the team
  if e.provider<>'off' and coalesce((e.auto->>'daily_report')::boolean,true) and coalesce(e.alert_emails,'')<>'' then
    site := coalesce(nullif(w.site_url,''),'');
    rep := '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;line-height:1.5;border-collapse:collapse">'||
      '<tr><td style="padding:8px 0;border-bottom:1px solid #EEF1F6">🎂 Birthdays today</td><td align="right" style="border-bottom:1px solid #EEF1F6"><b>'||(bd+mb)||'</b></td></tr>'||
      '<tr><td style="padding:8px 0;border-bottom:1px solid #EEF1F6">🩸 Camps today / tomorrow</td><td align="right" style="border-bottom:1px solid #EEF1F6"><b>'||(info->>'camps_today')||' / '||(info->>'camps_tomorrow')||'</b></td></tr>'||
      '<tr><td style="padding:8px 0;border-bottom:1px solid #EEF1F6">🗓️ Meetings today</td><td align="right" style="border-bottom:1px solid #EEF1F6"><b>'||(info->>'meetings_today')||'</b></td></tr>'||
      '<tr><td style="padding:8px 0;border-bottom:1px solid #EEF1F6">🚨 Open emergency requests</td><td align="right" style="border-bottom:1px solid #EEF1F6"><b>'||(info->>'open_emergencies')||'</b></td></tr>'||
      case when coalesce(low,'')<>'' then '<tr><td style="padding:8px 0;border-bottom:1px solid #EEF1F6">⚠️ Low stock</td><td align="right" style="border-bottom:1px solid #EEF1F6"><b>'||low||'</b></td></tr>' else '' end||
      '<tr><td style="padding:8px 0">'||case when jsonb_array_length(issues)=0 then '✅ System check' else '❗ Needs attention' end||'</td><td align="right"><b>'||case when jsonb_array_length(issues)=0 then 'All good' else jsonb_array_length(issues)::text end||'</b></td></tr></table>'||
      coalesce('<ul style="font-size:14px;line-height:1.5;color:#B4233A">'||(select string_agg('<li>'||replace(replace(x,'<','&lt;'),'>','&gt;')||'</li>','') from jsonb_array_elements_text(issues) x)||'</ul>','');
    for addr in select trim(x) from unnest(string_to_array(e.alert_emails,',')) x where trim(x)<>'' loop
      perform email_queue('daily_report',d::text,addr,'',jsonb_build_object('date',to_char(d,'DD Mon YYYY'),'report',rep,'link',site)); end loop; end if;
  return jsonb_build_object('ok',jsonb_array_length(issues)=0,'issues',issues,'info',info); end $$;
revoke execute on function morning_check(date) from public, anon;
grant execute on function morning_check(date) to authenticated;

-- run now from Settings (the button "Check now")
create or replace function run_morning_check() returns jsonb language plpgsql security definer set search_path=public as $$
begin if not (perm('settings') or perm('messages')) then raise exception 'Not allowed'; end if; return morning_check(ist_today()); end $$;
grant execute on function run_morning_check() to authenticated; revoke execute on function run_morning_check() from public, anon;

-- ask the email sender to run (pg_net); safe to call often
create or replace function email_kick() returns void language plpgsql security definer set search_path=public,private as $$
declare v_url text; v_key text; v_secret text; begin
  if (select provider from email_settings where id=1)='off' or not exists(select 1 from email_outbox where status='queued' and send_after<=now()) then return; end if;
  select c.v into v_url from private.config c where c.k='email_url'; select c.v into v_key from private.config c where c.k='anon_key'; select c.v into v_secret from private.config c where c.k='cron_secret';
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(url:=v_url, headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key,'x-cron-secret',v_secret), body:='{"action":"run"}'::jsonb, timeout_milliseconds:=30000);
exception when others then raise notice 'email kick: %', sqlerrm; end $$;
revoke execute on function email_kick() from public, anon, authenticated;

-- every 10 minutes: at (send time - 30 min) check the system and queue the day's WhatsApp and email; send waiting email
create or replace function daily_tick() returns jsonb language plpgsql security definer set search_path=public as $$
declare w wa_settings; d date := ist_today(); t time := (now() at time zone 'Asia/Kolkata')::time; out jsonb := '{}'; begin
  select * into w from wa_settings where id=1;
  if w.last_check_day is distinct from d and t >= (w.send_at - interval '30 minutes') then
    out := out||jsonb_build_object('check',morning_check(d));
    perform set_config('app.reverting','1',true); update wa_settings set last_check_day=d where id=1; perform set_config('app.reverting','',true); end if;
  if w.last_tick_day is distinct from d and t >= (w.send_at - interval '30 minutes') then
    out := out||jsonb_build_object('whatsapp',wa_daily_rules(d),'email',email_daily_rules(d));
    perform set_config('app.reverting','1',true); update wa_settings set last_tick_day=d where id=1; perform set_config('app.reverting','',true); end if;
  perform email_kick();
  return out; end $$;
revoke execute on function daily_tick() from public, anon, authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function daily_tick() to service_role; end if; end $$;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin perform cron.unschedule('wa-daily-rules'); exception when others then null; end;
    perform cron.schedule('crm-daily-tick','*/10 * * * *','select public.daily_tick()'); end if; end $$;

-- ======================= bell: open alerts =======================
create or replace function my_alerts() returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,'body',body,'link',link,'at',created_at) order by created_at desc),'[]')
  from (select * from app_alerts where resolved_at is null and created_at>now()-interval '30 days'
          and (perm('settings') or (kind in ('over_subscription') and (perm('members') or perm('funds'))) or (kind in ('emergency','morning_check') and perm('messages')))
        order by created_at desc limit 20) a $$;
grant execute on function my_alerts() to authenticated; revoke execute on function my_alerts() from public, anon;

-- public pages: show the camp type
create or replace function public_showcase() returns jsonb language sql stable security definer set search_path=public as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date d),
  items as (
    (select 'camp' as type, c.id::text as id, c.name as title, case when c.camp_type='Others' then coalesce(c.camp_type_other,'Camp') else c.camp_type||' camp' end as tag, c.camp_date as date, c.venue,
       case when c.status='live' then 'live' when c.camp_date>=(select d from today) then 'upcoming' else 'done' end as phase,
       left(nullif(trim(c.about),''),160) as about, case when c.camp_type='Blood donation' then (select count(*) from registrations r where r.camp_id=c.id)::int else c.beneficiaries end as people,
       case when c.camp_type='Blood donation' then 'registered' when c.beneficiaries is not null then 'people helped' end as people_label,
       case when c.camp_type='Blood donation' and c.status='open' and c.camp_date>=(select d from today) then '#/register/'||c.id end as link
     from camps c where c.deleted_at is null and c.status in ('planned','open','live') and c.camp_date>=(select d from today)-1
       and (c.camp_type<>'Blood donation' or c.status in ('open','live'))
     order by c.camp_date limit 4)
    union all
    (select 'event', e.id::text, e.title, e.kind, e.event_date, e.venue,
       case when e.event_date>=(select d from today) then 'upcoming' else 'done' end,
       left(nullif(trim(e.description),''),160), null::int, null::text,
       case when e.open_registration and e.status in ('planned','open') and e.event_date>=(select d from today) then '#/event/'||e.id end
     from events e where e.deleted_at is null and e.status<>'cancelled' and e.event_date>=(select d from today)-45
     order by (e.event_date<(select d from today)), abs(e.event_date-(select d from today)) limit 5)
    union all
    (select 'project', p.id::text, p.title, p.avenue, coalesce(p.start_date,p.end_date), p.venue,
       case p.status when 'ongoing' then 'ongoing' when 'completed' then 'done' else 'upcoming' end,
       left(nullif(trim(case when p.status='completed' then coalesce(p.outcome,p.description) else p.description end),''),160),
       p.beneficiaries, case when p.beneficiaries is not null then 'people helped' end, null
     from projects p where p.deleted_at is null and p.status in ('planned','ongoing','completed')
       and (p.status<>'completed' or coalesce(p.end_date,p.start_date,p.created_at::date)>=(select d from today)-120)
     order by (p.status='completed'), coalesce(p.start_date,p.end_date) desc nulls last limit 5))
  select coalesce(jsonb_agg(to_jsonb(i) order by case i.phase when 'live' then 0 when 'upcoming' then 1 when 'ongoing' then 2 else 3 end,
         case when i.phase='done' then -extract(epoch from i.date) else extract(epoch from i.date) end),'[]') from items i $$;
grant execute on function public_showcase() to anon, authenticated;

-- live updates for the new tables on the public pages
do $$ declare t text; begin
  foreach t in array array['camp_attendance','member_dues'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists pulse_%1$s on %1$I', t);
      execute format('create trigger pulse_%1$s after insert or update or delete on %1$I for each statement execute function bump_pulse()', t); end if; end loop; end $$;
