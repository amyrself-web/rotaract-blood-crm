-- v21: a second logo (for example the international / district logo) printed on the right of reports, letters and certificates. Run once, after v20.
alter table settings add column if not exists intl_logo_url text;
alter table settings add column if not exists intl_logo_label text;
create or replace function public_brand() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('brand_name',brand_name,'tagline',tagline,'logo_url',logo_url,'brand_color',brand_color,'club_name',club_name,
    'address',address,'contact_phone',contact_phone,'contact_email',contact_email,'signatory_name',signatory_name,'signatory_title',signatory_title,
    'signatory2_name',signatory2_name,'signatory2_title',signatory2_title,'reg_no',reg_no,'default_theme',default_theme,
    'intl_logo_url',intl_logo_url,'intl_logo_label',intl_logo_label)
  from settings where id=1 $$;
grant execute on function public_brand() to anon, authenticated;

-- day-before WhatsApp reminder for people registered at eye / cancer / other camps (same switch as the blood camp reminder)
create or replace function camp_people_rules(p_day date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare w wa_settings; d date := coalesce(p_day,ist_today()); club text; at timestamptz; n int := 0; begin
  select * into w from wa_settings where id=1; select club_name into club from settings where id=1;
  if not coalesce((w.auto->>'reminder_1d')::boolean,false) then return jsonb_build_object('camp_people_1d',0); end if;
  at := wa_next_slot(greatest(now(), ((d+w.send_at) at time zone 'Asia/Kolkata')));
  insert into wa_outbox(kind,ref,phone,name,body,vars,send_after,created_by)
  select 'camp_people_1d',c.id::text,p.phone,p.full_name,
    'Hello '||p.full_name||', a reminder that '||c.name||' is tomorrow ('||to_char(c.camp_date,'DD Mon YYYY')||coalesce(', '||to_char(c.start_time,'HH12:MI AM'),'')||') at '||coalesce(c.venue,'the venue')||
      '. Your token: T-'||lpad(p.token_no::text,3,'0')||'. '||case c.camp_type when 'Eye checking' then 'Please bring your old glasses and any eye reports.' else 'Please bring any old medical reports.' end||' - '||coalesce(club,''),
    jsonb_build_object('name',p.full_name,'camp',c.name),at,null
  from camp_people p join camps c on c.id=p.camp_id
  where c.camp_date=d+1 and c.deleted_at is null and c.status in ('open','live','planned') and p.status='registered' and p.consent and p.phone ~ '^[6-9][0-9]{9}$'
    and not exists(select 1 from wa_optout o where o.phone=p.phone and o.active)
  on conflict do nothing; get diagnostics n=row_count;
  return jsonb_build_object('camp_people_1d',n); end $$;
revoke execute on function camp_people_rules(date) from public, anon, authenticated;

create or replace function daily_tick() returns jsonb language plpgsql security definer set search_path=public as $$
declare w wa_settings; d date := ist_today(); t time := (now() at time zone 'Asia/Kolkata')::time; out jsonb := '{}'; begin
  select * into w from wa_settings where id=1;
  if w.last_check_day is distinct from d and t >= (w.send_at - interval '30 minutes') then
    out := out||jsonb_build_object('check',morning_check(d));
    perform set_config('app.reverting','1',true); update wa_settings set last_check_day=d where id=1; perform set_config('app.reverting','',true); end if;
  if w.last_tick_day is distinct from d and t >= (w.send_at - interval '30 minutes') then
    out := out||jsonb_build_object('whatsapp',wa_daily_rules(d)||camp_people_rules(d),'email',email_daily_rules(d));
    perform set_config('app.reverting','1',true); update wa_settings set last_tick_day=d where id=1; perform set_config('app.reverting','',true); end if;
  perform email_kick();
  return out; end $$;
revoke execute on function daily_tick() from public, anon, authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function daily_tick() to service_role; end if; end $$;

-- front page: open eye / cancer / other camps get a Register button too
create or replace function public_showcase() returns jsonb language sql stable security definer set search_path=public as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date d),
  items as (
    (select 'camp' as type, c.id::text as id, c.name as title, case when c.camp_type='Others' then coalesce(c.camp_type_other,'Camp') else c.camp_type||' camp' end as tag, c.camp_date as date, c.venue,
       case when c.status='live' then 'live' when c.camp_date>=(select d from today) then 'upcoming' else 'done' end as phase,
       left(nullif(trim(c.about),''),160) as about, case when c.camp_type='Blood donation' then (select count(*) from registrations r where r.camp_id=c.id)::int else c.beneficiaries end as people,
       case when c.camp_type='Blood donation' then 'registered' when c.beneficiaries is not null then 'people helped' end as people_label,
       case when c.camp_type in ('Blood donation','Eye checking','Cancer awareness','Others') and c.status='open' and c.camp_date>=(select d from today) then '#/register/'||c.id end as link
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
