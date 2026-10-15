-- Phase 8 part 1: camp planning (tasks, volunteers, sponsors, expenses) and reports. Run once (after phase6.sql)
alter table camps add column budget numeric;
create table tasks(id uuid primary key default gen_random_uuid(), camp_id uuid not null references camps on delete cascade,
  title text not null, assignee text, due date, done boolean not null default false, created_at timestamptz default now());
create table camp_volunteers(id uuid primary key default gen_random_uuid(), camp_id uuid not null references camps on delete cascade,
  name text not null, phone text, desk text, shift text, attended boolean not null default false, created_at timestamptz default now());
create table sponsors(id uuid primary key default gen_random_uuid(), camp_id uuid not null references camps on delete cascade,
  name text not null, amount numeric not null default 0, received boolean not null default false, notes text, created_at timestamptz default now());
create table expenses(id uuid primary key default gen_random_uuid(), camp_id uuid not null references camps on delete cascade,
  category text not null, description text, amount numeric not null check (amount>=0), spent_on date not null default current_date, created_at timestamptz default now());
alter table tasks enable row level security; alter table camp_volunteers enable row level security;
alter table sponsors enable row level security; alter table expenses enable row level security;
create policy "staff manage tasks" on tasks for all using (has_role(array['admin','coordinator']::app_role[])) with check (has_role(array['admin','coordinator']::app_role[]));
create policy "staff manage volunteers" on camp_volunteers for all using (has_role(array['admin','coordinator']::app_role[])) with check (has_role(array['admin','coordinator']::app_role[]));
create policy "staff manage sponsors" on sponsors for all using (has_role(array['admin','coordinator']::app_role[])) with check (has_role(array['admin','coordinator']::app_role[]));
create policy "staff manage expenses" on expenses for all using (has_role(array['admin','coordinator']::app_role[])) with check (has_role(array['admin','coordinator']::app_role[]));

create function camp_report(p_camp uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; begin
  if not has_role(array['admin','coordinator']::app_role[]) then raise exception 'Not allowed'; end if;
  select jsonb_build_object(
    'camp',jsonb_build_object('name',c.name,'date',c.camp_date,'venue',c.venue,'target',c.target_donors,'budget',c.budget),
    'registered',(select count(*) from registrations where camp_id=c.id),
    'arrived',(select count(*) from registrations where camp_id=c.id and status in ('checked_in','screened','donated','deferred')),
    'donated',(select count(*) from registrations where camp_id=c.id and status='donated'),
    'deferred',(select count(*) from registrations where camp_id=c.id and status='deferred'),
    'no_show',(select count(*) from registrations where camp_id=c.id and status='no_show'),
    'volume_ml',(select coalesce(sum(n.volume_ml),0) from donations n join registrations r on r.id=n.registration_id where r.camp_id=c.id),
    'first_time',(select count(*) from registrations r join donations n on n.registration_id=r.id where r.camp_id=c.id and not exists(
      select 1 from registrations r2 join donations n2 on n2.registration_id=r2.id where r2.donor_id=r.donor_id and r2.camp_id<>c.id and n2.created_at<n.created_at)),
    'by_group',coalesce((select jsonb_object_agg(g,cnt) from (select coalesce(d.blood_group::text,'Unknown') g,count(*) cnt
      from registrations r join donations n on n.registration_id=r.id join donors d on d.id=r.donor_id where r.camp_id=c.id group by 1) x),'{}'::jsonb),
    'sponsors_received',(select coalesce(sum(amount),0) from sponsors where camp_id=c.id and received),
    'sponsors_pledged',(select coalesce(sum(amount),0) from sponsors where camp_id=c.id),
    'expenses',(select coalesce(sum(amount),0) from expenses where camp_id=c.id),
    'volunteers',(select count(*) from camp_volunteers where camp_id=c.id),
    'volunteers_present',(select count(*) from camp_volunteers where camp_id=c.id and attended),
    'tasks_done',(select count(*) from tasks where camp_id=c.id and done),
    'tasks_total',(select count(*) from tasks where camp_id=c.id)) into r
  from camps c where c.id=p_camp;
  return r; end $$;
grant execute on function camp_report to authenticated;
