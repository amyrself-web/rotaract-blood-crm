-- v15: "What's happening" on the sign-in page. Run once, after v14.
-- Shows upcoming camps, events and service projects to anyone (no sign-in), one by one.
-- Only public-safe fields: title, date, venue, a short description and the number of people helped.
-- No budgets, no member or donor names, nothing deleted or cancelled.
create or replace function public_showcase() returns jsonb language sql stable security definer set search_path=public as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date d),
  items as (
    (select 'camp' as type, c.id::text as id, c.name as title, 'Blood donation camp' as tag, c.camp_date as date, c.venue,
       case when c.status='live' then 'live' when c.camp_date>=(select d from today) then 'upcoming' else 'done' end as phase,
       null::text as about, (select count(*) from registrations r where r.camp_id=c.id)::int as people, 'registered' as people_label,
       case when c.status='open' and c.camp_date>=(select d from today) then '#/register/'||c.id end as link
     from camps c where c.deleted_at is null and c.status in ('open','live') and c.camp_date>=(select d from today)-1
     order by c.camp_date limit 3)
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
