-- v11: service projects, volunteer hours, notice board and polls, induction of new members, board history and the
-- monthly report for the district. Uses the existing Members and Meetings permissions. Run once, after v10.

-- ---------- service projects ----------
create sequence if not exists projects_no_seq;
create table if not exists projects(
  id uuid primary key default gen_random_uuid(),
  project_no int unique,
  title text not null,
  avenue text not null default 'Community service' check (avenue in ('Club service','Community service','Professional development','International service','Blood donation','Public image','Other')),
  status text not null default 'planned' check (status in ('planned','ongoing','completed','cancelled')),
  start_date date, end_date date, venue text, partner text,
  lead_member uuid references members on delete set null,
  beneficiaries int check (beneficiaries is null or beneficiaries>=0),
  budget numeric(12,2) check (budget is null or budget>=0), spent numeric(12,2) check (spent is null or spent>=0),
  description text, outcome text, photo_links text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid);
alter table projects enable row level security;
create policy "projects manage" on projects for all using (perm('members')) with check (perm('members'));
create policy "projects members read" on projects for select using (deleted_at is null and (my_member()).id is not null);
grant select, insert, update on projects to authenticated;

create table if not exists project_hours(
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members on delete cascade,
  project_id uuid references projects on delete set null,
  camp_id uuid references camps on delete set null,
  work_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  hours numeric(5,2) not null check (hours>0 and hours<=24),
  role text, notes text,
  approved boolean not null default true, self_logged boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now());
alter table project_hours enable row level security;
create policy "hours manage" on project_hours for all using (perm('members')) with check (perm('members'));
create policy "hours own read" on project_hours for select using (member_id=(my_member()).id);
grant select, insert, update, delete on project_hours to authenticated;
create index if not exists project_hours_member on project_hours(member_id, work_date);

create or replace function validate_project() returns trigger language plpgsql set search_path=public as $$
begin
  if length(trim(coalesce(new.title,'')))<3 then raise exception 'Enter the project name'; end if;
  if new.end_date is not null and new.start_date is not null and new.end_date<new.start_date then raise exception 'End date is before the start date'; end if;
  if tg_op='INSERT' then new.project_no := coalesce(new.project_no,nextval('projects_no_seq')); end if;
  new.title := trim(new.title); return new; end $$;
create or replace trigger validate_projects before insert or update on projects for each row execute function validate_project();
create or replace trigger audit_projects after insert or update or delete on projects for each row execute function audit_row();
create or replace trigger audit_project_hours after insert or update or delete on project_hours for each row execute function audit_row();

-- a member logs their own service hours; the secretary approves them
create or replace function log_my_hours(p_project uuid, p_date date, p_hours numeric, p_role text default null, p_notes text default null) returns void
language plpgsql security definer set search_path=public as $$
declare m members := my_member(); begin
  if m.id is null then raise exception 'Your login is not linked to a member record'; end if;
  if p_hours is null or p_hours<=0 or p_hours>24 then raise exception 'Hours must be between 0 and 24'; end if;
  if p_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'The date cannot be in the future'; end if;
  insert into project_hours(member_id,project_id,work_date,hours,role,notes,approved,self_logged) values(m.id,p_project,p_date,p_hours,left(p_role,80),left(p_notes,300),false,true); end $$;

-- ---------- notice board and polls ----------
create table if not exists notices(
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title))>=3), body text, pinned boolean not null default false,
  expires_on date, created_by uuid default auth.uid(), created_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);
alter table notices enable row level security;
create policy "notices manage" on notices for all using (perm('meetings')) with check (perm('meetings'));
create policy "notices members read" on notices for select using (deleted_at is null and (my_member()).id is not null);
grant select, insert, update on notices to authenticated;
create or replace trigger audit_notices after insert or update or delete on notices for each row execute function audit_row();

create table if not exists polls(
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(trim(question))>=5),
  options text[] not null check (array_length(options,1) between 2 and 8),
  closes_at timestamptz, anonymous boolean not null default true,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);
alter table polls enable row level security;
create policy "polls manage" on polls for all using (perm('meetings')) with check (perm('meetings'));
create policy "polls members read" on polls for select using (deleted_at is null and (my_member()).id is not null);
grant select, insert, update on polls to authenticated;
create table if not exists poll_votes(
  poll_id uuid not null references polls on delete cascade, member_id uuid not null references members on delete cascade,
  choice int not null, voted_at timestamptz not null default now(), primary key(poll_id, member_id));
alter table poll_votes enable row level security;
create policy "poll votes staff" on poll_votes for select using (perm('meetings'));
grant select on poll_votes to authenticated;

create or replace function vote_poll(p_poll uuid, p_choice int) returns void language plpgsql security definer set search_path=public as $$
declare m members := my_member(); p polls; begin
  if m.id is null then raise exception 'Only club members can vote'; end if;
  select * into p from polls where id=p_poll and deleted_at is null; if p.id is null then raise exception 'Poll not found'; end if;
  if p.closes_at is not null and p.closes_at<now() then raise exception 'This poll is closed'; end if;
  if p_choice<1 or p_choice>array_length(p.options,1) then raise exception 'Choose one of the options'; end if;
  insert into poll_votes(poll_id,member_id,choice) values(p_poll,m.id,p_choice) on conflict (poll_id,member_id) do update set choice=excluded.choice, voted_at=now(); end $$;

create or replace function poll_results(p_poll uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p polls; begin
  if not (perm('meetings') or (my_member()).id is not null) then raise exception 'Not allowed'; end if;
  select * into p from polls where id=p_poll;
  return jsonb_build_object('total',(select count(*) from poll_votes where poll_id=p_poll),
    'counts',(select jsonb_agg((select count(*) from poll_votes v where v.poll_id=p_poll and v.choice=i) order by i) from generate_series(1,array_length(p.options,1)) i),
    'voters',case when perm('meetings') and not p.anonymous then (select jsonb_agg(jsonb_build_object('name',m.full_name,'choice',v.choice)) from poll_votes v join members m on m.id=v.member_id where v.poll_id=p_poll) end,
    'mine',(select choice from poll_votes where poll_id=p_poll and member_id=(my_member()).id)); end $$;

-- everything new on the member's own page
create or replace function my_club_extra() returns jsonb language plpgsql security definer set search_path=public as $$
declare m members := my_member(); ry_from date; begin
  if m.id is null then return null; end if;
  ry_from := make_date(case when extract(month from current_date)>=7 then extract(year from current_date)::int else extract(year from current_date)::int-1 end,7,1);
  return jsonb_build_object(
    'notices',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'body',n.body,'pinned',n.pinned,'at',n.created_at) order by n.pinned desc, n.created_at desc)
      from notices n where n.deleted_at is null and (n.expires_on is null or n.expires_on>=current_date)),'[]'),
    'polls',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'question',p.question,'options',p.options,'closes_at',p.closes_at,'open',p.closes_at is null or p.closes_at>now(),
        'mine',(select choice from poll_votes v where v.poll_id=p.id and v.member_id=m.id),
        'counts',(select jsonb_agg((select count(*) from poll_votes v where v.poll_id=p.id and v.choice=i) order by i) from generate_series(1,array_length(p.options,1)) i)) order by p.created_at desc)
      from polls p where p.deleted_at is null and p.created_at>now()-interval '120 days'),'[]'),
    'hours',jsonb_build_object('approved',(select coalesce(sum(hours),0) from project_hours where member_id=m.id and approved and work_date>=ry_from),
      'pending',(select coalesce(sum(hours),0) from project_hours where member_id=m.id and not approved),
      'recent',coalesce((select jsonb_agg(jsonb_build_object('date',h.work_date,'hours',h.hours,'project',p.title,'role',h.role,'approved',h.approved) order by h.work_date desc)
        from (select * from project_hours where member_id=m.id order by work_date desc limit 8) h left join projects p on p.id=h.project_id),'[]')),
    'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'avenue',p.avenue,'status',p.status,'start',p.start_date) order by p.start_date desc nulls last)
      from projects p where p.deleted_at is null and p.status in ('planned','ongoing') ),'[]'),
    'induction',case when m.membership_type='Prospective' then (select coalesce(jsonb_agg(jsonb_build_object('step',s.step,'done_on',s.done_on) order by s.done_on),'[]') from induction_steps s where s.member_id=m.id) end);
end $$;

-- ---------- induction of new members ----------
create table if not exists induction_steps(
  member_id uuid not null references members on delete cascade,
  step text not null check (step in ('meetings','orientation','form','fee','project','inducted')),
  done_on date not null default ((now() at time zone 'Asia/Kolkata')::date), note text,
  created_by uuid default auth.uid(), primary key(member_id, step));
alter table induction_steps enable row level security;
create policy "induction manage" on induction_steps for all using (perm('members')) with check (perm('members'));
create policy "induction own read" on induction_steps for select using (member_id=(my_member()).id);
grant select, insert, update, delete on induction_steps to authenticated;
create or replace trigger audit_induction_steps after insert or update or delete on induction_steps for each row execute function audit_row();

create or replace function induct_member(p_member uuid, p_date date) returns void language plpgsql security definer set search_path=public as $$
begin
  if not perm('members') then raise exception 'Not allowed'; end if;
  update members set membership_type='Active', status='active', joined_on=coalesce(p_date,joined_on) where id=p_member;
  insert into induction_steps(member_id,step,done_on) values(p_member,'inducted',coalesce(p_date,current_date)) on conflict (member_id,step) do update set done_on=excluded.done_on; end $$;

-- ---------- board history and the start of a new Rotary year ----------
create table if not exists board_terms(
  id uuid primary key default gen_random_uuid(),
  rotary_year text not null check (rotary_year ~ '^[0-9]{4}-[0-9]{2}$'),
  member_id uuid references members on delete set null, member_name text not null,
  position text not null, created_at timestamptz not null default now(), unique(rotary_year, position, member_name));
alter table board_terms enable row level security;
create policy "board terms read" on board_terms for select using (perm('members') or (my_member()).id is not null);
create policy "board terms manage" on board_terms for all using (perm('members')) with check (perm('members'));
grant select, insert, update on board_terms to authenticated;

-- p_board: [{member_id, position}] for the new year. Everyone else on the old board becomes 'Member'. The outgoing board is kept in history.
create or replace function start_rotary_year(p_year text, p_board jsonb) returns int language plpgsql security definer set search_path=public as $$
declare x jsonb; n int := 0; prev text; begin
  if not perm('members') then raise exception 'Not allowed'; end if;
  if p_year !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'Rotary year looks like 2026-27'; end if;
  prev := (left(p_year,4)::int-1)::text||'-'||right(left(p_year,4),2);
  insert into board_terms(rotary_year,member_id,member_name,position)
    select prev,id,full_name,position from members where deleted_at is null and position<>'Member' on conflict do nothing;
  update members set position='Member' where deleted_at is null and position<>'Member';
  for x in select * from jsonb_array_elements(p_board) loop
    if coalesce(x->>'member_id','')='' or coalesce(x->>'position','')='' then continue; end if;
    update members set position=x->>'position' where id=(x->>'member_id')::uuid;
    insert into board_terms(rotary_year,member_id,member_name,position) select p_year,id,full_name,x->>'position' from members where id=(x->>'member_id')::uuid on conflict do nothing;
    update profiles set designation=x->>'position' where id=(select profile_id from members where id=(x->>'member_id')::uuid);
    n := n+1; end loop;
  return n; end $$;

-- ---------- monthly report for the district ----------
create or replace function district_report(p_month date) returns jsonb language plpgsql security definer set search_path=public as $$
declare f date := date_trunc('month',p_month)::date; t date := (date_trunc('month',p_month)+interval '1 month - 1 day')::date; begin
  if not (perm('reports') or perm('members')) then raise exception 'Not allowed'; end if;
  return jsonb_build_object('from',f,'to',t,'club',(select club_name from settings where id=1),
    'members',jsonb_build_object('active',(select count(*) from members where deleted_at is null and status='active' and membership_type in ('Active','Honorary')),
      'prospective',(select count(*) from members where deleted_at is null and status='active' and membership_type='Prospective'),
      'joined',(select coalesce(jsonb_agg(full_name),'[]') from members where deleted_at is null and joined_on between f and t),
      'left',(select coalesce(jsonb_agg(full_name),'[]') from members where deleted_at is null and left_on between f and t)),
    'meetings',coalesce((select jsonb_agg(jsonb_build_object('no',mt.meeting_no,'date',mt.meeting_date,'kind',mt.kind,'title',mt.title,'chief_guest',mt.chief_guest,
        'present',(select count(*) from meeting_attendance a where a.meeting_id=mt.id and a.status in ('present','late')),
        'expected',(select count(*) from members x where x.deleted_at is null and x.status='active' and x.membership_type in ('Active','Prospective') and coalesce(x.joined_on,mt.meeting_date)<=mt.meeting_date)) order by mt.meeting_date)
      from meetings mt where mt.deleted_at is null and mt.status='held' and mt.meeting_date between f and t),'[]'),
    'projects',coalesce((select jsonb_agg(jsonb_build_object('no',p.project_no,'title',p.title,'avenue',p.avenue,'status',p.status,'date',p.start_date,'beneficiaries',p.beneficiaries,'spent',p.spent,'partner',p.partner,
        'hours',(select coalesce(sum(hours),0) from project_hours h where h.project_id=p.id and h.approved),'volunteers',(select count(distinct member_id) from project_hours h where h.project_id=p.id and h.approved)) order by p.start_date)
      from projects p where p.deleted_at is null and p.status<>'cancelled' and coalesce(p.end_date,p.start_date) between f and t),'[]'),
    'camps',coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'date',c.camp_date,'venue',c.venue,
        'registered',(select count(*) from registrations r where r.camp_id=c.id),'donated',(select count(*) from registrations r where r.camp_id=c.id and r.status='donated'),
        'deferred',(select count(*) from registrations r where r.camp_id=c.id and r.status='deferred')) order by c.camp_date)
      from camps c where c.deleted_at is null and c.camp_date between f and t),'[]'),
    'afterlife',jsonb_build_object('pledges',(select count(*) from pledges where deleted_at is null and pledged_on between f and t),
      'eye',(select count(*) from afterlife_cases where deleted_at is null and status in ('collected','handed over') and 'eye'=any(kinds) and died_on between f and t),
      'body',(select count(*) from afterlife_cases where deleted_at is null and status in ('collected','handed over') and 'body'=any(kinds) and died_on between f and t)),
    'hours',(select coalesce(sum(hours),0) from project_hours where approved and work_date between f and t),
    'funds',jsonb_build_object('received',(select coalesce(sum(amount),0) from contributions where status='received' and received_on between f and t),
      'dues',(select coalesce(sum(amount),0) from member_dues where paid_on between f and t),
      'spent',(select coalesce(sum(amount),0) from club_expenses where status<>'cancelled' and spent_on between f and t)));
end $$;

grant execute on function log_my_hours(uuid,date,numeric,text,text), vote_poll(uuid,int), poll_results(uuid), my_club_extra(), induct_member(uuid,date), start_rotary_year(text,jsonb), district_report(date) to authenticated;
revoke execute on function log_my_hours(uuid,date,numeric,text,text), vote_poll(uuid,int), poll_results(uuid), my_club_extra(), induct_member(uuid,date), start_rotary_year(text,jsonb), district_report(date), validate_project() from public, anon;
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['projects','project_hours','notices','polls','poll_votes','induction_steps'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=t) then execute format('alter publication supabase_realtime add table %I',t); end if;
    end loop; end if; end $$;
