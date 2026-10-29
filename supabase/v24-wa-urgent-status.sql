-- v24: WhatsApp queue says why a message is waiting, and a broadcast can be marked "send now, even at night".
-- Run once, after v23.
alter table wa_outbox add column if not exists urgent boolean not null default false;

drop function if exists wa_enqueue(text,text,jsonb,timestamptz,boolean);
create or replace function wa_enqueue(p_title text, p_kind text, p_items jsonb, p_send_after timestamptz default null, p_manual boolean default false, p_urgent boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b uuid; bno int; n int := 0; skipped int := 0; x jsonb; ph text; at timestamptz; begin
  if not perm('messages') then raise exception 'You do not have permission to send messages'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Nobody to send to'; end if;
  if jsonb_array_length(p_items)>3000 then raise exception 'Send to at most 3000 people at a time'; end if;
  at := case when p_manual or p_urgent or p_kind='emergency' then greatest(coalesce(p_send_after,now()),now()) else wa_next_slot(greatest(coalesce(p_send_after,now()),now())) end;
  insert into wa_broadcasts(title,kind) values(left(coalesce(nullif(trim(p_title),''),p_kind),120),p_kind) returning id,broadcast_no into b,bno;
  for x in select * from jsonb_array_elements(p_items) loop
    ph := right(regexp_replace(coalesce(x->>'phone',''),'\D','','g'),10);
    if ph !~ '^[6-9][0-9]{9}$' or exists(select 1 from wa_optout where phone=ph and active) or length(coalesce(x->>'body',''))<1 then skipped:=skipped+1; continue; end if;
    insert into wa_outbox(broadcast_id,kind,ref,phone,name,donor_id,member_id,body,vars,send_after,manual,urgent)
      values(b,p_kind,nullif(x->>'ref',''),ph,x->>'name',nullif(x->>'donor_id','')::uuid,nullif(x->>'member_id','')::uuid,left(x->>'body',4000),x->'vars',at,coalesce(p_manual,false),coalesce(p_urgent,false))
      on conflict do nothing;
    if found then n:=n+1; else skipped:=skipped+1; end if;
  end loop;
  update wa_broadcasts set total=n where id=b;
  return jsonb_build_object('broadcast_id',b,'broadcast_no',bno,'queued',n,'skipped',skipped,'send_after',at,'manual',coalesce(p_manual,false),'urgent',coalesce(p_urgent,false)); end $$;
grant execute on function wa_enqueue(text,text,jsonb,timestamptz,boolean,boolean) to authenticated;
revoke execute on function wa_enqueue(text,text,jsonb,timestamptz,boolean,boolean) from public, anon;

-- urgent messages go out in quiet hours too
create or replace function wa_claim(p_limit integer default 1) returns setof wa_outbox language plpgsql security definer set search_path=public as $$
declare w wa_settings; done_today int; quiet boolean; begin
  select * into w from wa_settings where id=1;
  update wa_outbox set status='queued' where status='sending' and claimed_at<now()-interval '10 minutes';
  if w.provider not in ('qr','cloud') then return; end if;
  quiet := wa_next_slot(now())>now();
  select count(*) into done_today from wa_outbox where status='sent' and sent_at>=(wa_ist_today()::timestamp at time zone 'Asia/Kolkata');
  if done_today>=w.daily_cap then return; end if;
  return query update wa_outbox o set status='sending', attempts=o.attempts+1, provider=w.provider, claimed_at=now()
    where o.id in (select id from wa_outbox where status='queued' and not manual and send_after<=now() and (not quiet or kind='emergency' or urgent)
                   and not exists(select 1 from wa_optout x where x.phone=wa_outbox.phone and x.active)
                   order by (kind='emergency' or urgent) desc, send_after, created_at limit least(p_limit, w.daily_cap-done_today) for update skip locked)
    returning o.*;
end $$;

-- a waiting message can be made urgent later (send now, even in quiet hours)
create or replace function wa_send_now(p_ids uuid[]) returns int language plpgsql security definer set search_path=public as $$
declare n int; begin
  if not perm('messages') then raise exception 'Not allowed'; end if;
  update wa_outbox set urgent=true, send_after=least(send_after,now()) where status='queued' and id=any(p_ids);
  get diagnostics n=row_count; return n; end $$;
grant execute on function wa_send_now(uuid[]) to authenticated;
revoke execute on function wa_send_now(uuid[]) from public, anon;

-- status also tells the screen whether it is quiet hours now and how many more can go today
create or replace function wa_status() returns jsonb language plpgsql security definer set search_path=public as $$
declare s wa_session; w wa_settings; st text; sent int; begin
  if not (perm('messages') or perm('settings')) then raise exception 'Not allowed'; end if;
  select * into s from wa_session where id=1; select * into w from wa_settings where id=1;
  st := case when s.last_seen<now()-interval '2 minutes' then 'offline' else s.status end;
  sent := (select count(*) from wa_outbox where status='sent' and sent_at>=(wa_ist_today()::timestamp at time zone 'Asia/Kolkata'));
  return jsonb_build_object('provider',w.provider,'per_minute',w.per_minute,'daily_cap',w.daily_cap,'status',st,
    'ready',(w.provider='cloud' or (w.provider='qr' and st='connected')),
    'qr',case when perm('settings') and s.last_seen>now()-interval '2 minutes' then s.qr end,'phone',s.phone,'name',s.name,'last_seen',s.last_seen,'worker_version',s.worker_version,
    'queued',(select count(*) from wa_outbox where status in ('queued','sending')),
    'manual_waiting',(select count(*) from wa_outbox where status='queued' and manual),
    'sent_today',sent,'cap_left',greatest(0,w.daily_cap-sent),
    'failed_today',(select count(*) from wa_outbox where status='failed' and created_at>=(wa_ist_today()::timestamp at time zone 'Asia/Kolkata')),
    'quiet_now',wa_next_slot(now())>now(),'quiet_from',w.quiet_from,'quiet_to',w.quiet_to,'quiet_ends',wa_next_slot(now()),
    'next_at',(select min(send_after) from wa_outbox where status='queued' and not manual)); end $$;
