-- v25: the numbers for every camp (any camp type) in one call, and the dashboard's numbers for the whole club.
-- Run once, after v24.

-- per camp: registered / came / donated (blood), registered / seen / referred (eye, cancer, others), fed and packets (food),
-- saplings planted and alive (plantation), talk audience, and members present
create or replace function camp_numbers() returns table(camp_id uuid, registered int, arrived int, donated int, seen int, referred int,
  follow_pending int, fed int, packets int, food_points int, planted int, alive int, talks int, heard int, members_present int)
language plpgsql stable security definer set search_path=public as $$
begin
  if not (perm('camps') or perm('campday') or perm('screening') or perm('planning') or perm('reports')) then raise exception 'Not allowed'; end if;
  return query
  select c.id,
    case when c.camp_type='Blood donation' then (select count(*) from registrations r where r.camp_id=c.id) else (select count(*) from camp_people p where p.camp_id=c.id) end::int,
    (select count(*) from registrations r where r.camp_id=c.id and r.status not in ('registered','no_show'))::int,
    (select count(*) from registrations r where r.camp_id=c.id and r.status='donated')::int,
    (select count(*) from camp_people p where p.camp_id=c.id and p.status='attended')::int,
    (select count(*) from camp_people p where p.camp_id=c.id and coalesce(trim(p.referred_to),'')<>'')::int,
    (select count(*) from camp_people p where p.camp_id=c.id and p.follow_up='pending')::int,
    (select coalesce(sum(f.people),0) from camp_food f where f.camp_id=c.id)::int,
    (select coalesce(sum(f.packets),0) from camp_food f where f.camp_id=c.id)::int,
    (select count(*) from camp_food f where f.camp_id=c.id)::int,
    (select coalesce(sum(s.count),0) from camp_saplings s where s.camp_id=c.id)::int,
    (select coalesce(sum(s.alive),0) from camp_saplings s where s.camp_id=c.id and s.alive is not null)::int,
    (select count(*) from camp_sessions x where x.camp_id=c.id)::int,
    (select coalesce(sum(x.attendees),0) from camp_sessions x where x.camp_id=c.id)::int,
    (select count(*) from camp_attendance a where a.camp_id=c.id and a.status in ('present','late'))::int
  from camps c where c.deleted_at is null;
end $$;
revoke execute on function camp_numbers() from public, anon;
grant execute on function camp_numbers() to authenticated;

-- the dashboard: only the parts the signed-in person may see
create or replace function dashboard_numbers() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare d date := ist_today(); ys date; ye date; out jsonb := '{}'; begin
  ys := make_date(case when extract(month from d)>=7 then extract(year from d)::int else extract(year from d)::int-1 end,7,1); ye := (ys + interval '1 year')::date;
  out := jsonb_build_object('today',d,'year_start',ys);
  if perm('donors') or perm('camps') or perm('screening') or perm('campday') then
    out := out||jsonb_build_object(
      'donors',(select count(*) from donors where deleted_at is null),
      'consent',(select count(*) from donors where deleted_at is null and consent),
      'eligible',(select count(*) from donors where deleted_at is null and consent and (last_donation is null or last_donation <= d - case when gender='Female' then 120 else 90 end)),
      'donations',(select count(*) from donations),
      'donations_year',(select count(*) from donations x join registrations r on r.id=x.registration_id join camps c on c.id=r.camp_id where c.camp_date>=ys and c.camp_date<ye),
      'camps_upcoming',(select count(*) from camps where deleted_at is null and camp_date>=d and status not in ('closed','completed')),
      'camps_done_year',(select count(*) from camps where deleted_at is null and camp_date>=ys and camp_date<ye and status in ('completed','closed')),
      'camps_by_type',(select coalesce(jsonb_object_agg(t,n),'{}') from (select camp_type t,count(*) n from camps where deleted_at is null and camp_date>=ys and camp_date<ye group by 1) x),
      'screened',(select count(*) from camp_people p join camps c on c.id=p.camp_id where c.deleted_at is null and p.status='attended'),
      'follow_pending',(select count(*) from camp_people p join camps c on c.id=p.camp_id where c.deleted_at is null and p.follow_up='pending'),
      'fed',(select coalesce(sum(f.people),0) from camp_food f join camps c on c.id=f.camp_id where c.deleted_at is null),
      'planted',(select coalesce(sum(s.count),0) from camp_saplings s join camps c on c.id=s.camp_id where c.deleted_at is null),
      'donor_birthdays',(select count(*) from donors where deleted_at is null and dob is not null and to_char(dob,'MM-DD')=to_char(d,'MM-DD')));
  end if;
  if perm('members') or perm('meetings') then
    out := out||jsonb_build_object(
      'members',(select count(*) from members where deleted_at is null and status='active'),
      'members_new_year',(select count(*) from members where deleted_at is null and joined_on>=ys and joined_on<ye),
      'member_birthdays',(select coalesce(jsonb_agg(full_name order by full_name),'[]') from members where deleted_at is null and status='active' and dob is not null and to_char(dob,'MM-DD')=to_char(d,'MM-DD')),
      'meetings_week',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'kind',case when kind='Others' then coalesce(kind_other,kind) else kind end,'date',meeting_date,'time',start_time,'venue',venue,'audience',audience) order by meeting_date,start_time),'[]')
        from meetings where deleted_at is null and status not in ('cancelled','held') and meeting_date between d and d+7),
      'meetings_year',(select count(*) from meetings where deleted_at is null and status='held' and meeting_date>=ys and meeting_date<ye),
      'events_next',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'date',event_date,'venue',venue) order by event_date),'[]')
        from (select * from events where deleted_at is null and event_date>=d and coalesce(status,'')<>'cancelled' order by event_date limit 3) e),
      'projects_active',(select count(*) from projects where deleted_at is null and status in ('planned','ongoing','active','in progress')),
      'hours_year',(select coalesce(sum(hours),0) from project_hours where approved and created_at>=ys));
  end if;
  if perm('members') or perm('funds') then
    out := out||jsonb_build_object(
      'dues_paid_year',(select count(distinct member_id) from member_dues where paid_on>=ys and paid_on<ye),
      'dues_amount_year',(select coalesce(sum(amount),0) from member_dues where paid_on>=ys and paid_on<ye));
  end if;
  if perm('funds') then
    out := out||jsonb_build_object(
      'received_year',(select coalesce(sum(amount),0) from contributions where status='received' and received_on>=ys and received_on<ye));
  end if;
  if perm('messages') then
    out := out||jsonb_build_object(
      'wa_sent_today',(select count(*) from wa_outbox where status='sent' and sent_at>=(d::timestamp at time zone 'Asia/Kolkata')),
      'wa_waiting',(select count(*) from wa_outbox where status in ('queued','sending')),
      'wa_failed_today',(select count(*) from wa_outbox where status='failed' and created_at>=(d::timestamp at time zone 'Asia/Kolkata')));
  end if;
  return out; end $$;
revoke execute on function dashboard_numbers() from public, anon;
grant execute on function dashboard_numbers() to authenticated;
