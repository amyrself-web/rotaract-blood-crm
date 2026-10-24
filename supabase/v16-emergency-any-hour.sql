-- v16: emergency blood alerts go out at any hour. Run once, after v15.
-- Everything else still waits for the end of quiet hours (set in WhatsApp and alerts → Connect).
create or replace function wa_enqueue(p_title text, p_kind text, p_items jsonb, p_send_after timestamptz default null, p_manual boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b uuid; bno int; n int := 0; skipped int := 0; x jsonb; ph text; at timestamptz; begin
  if not perm('messages') then raise exception 'You do not have permission to send messages'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Nobody to send to'; end if;
  if jsonb_array_length(p_items)>3000 then raise exception 'Send to at most 3000 people at a time'; end if;
  at := case when p_manual or p_kind='emergency' then greatest(coalesce(p_send_after,now()),now()) else wa_next_slot(greatest(coalesce(p_send_after,now()),now())) end;
  insert into wa_broadcasts(title,kind) values(left(coalesce(nullif(trim(p_title),''),p_kind),120),p_kind) returning id,broadcast_no into b,bno;
  for x in select * from jsonb_array_elements(p_items) loop
    ph := right(regexp_replace(coalesce(x->>'phone',''),'\D','','g'),10);
    if ph !~ '^[6-9][0-9]{9}$' or exists(select 1 from wa_optout where phone=ph and active) or length(coalesce(x->>'body',''))<1 then skipped:=skipped+1; continue; end if;
    insert into wa_outbox(broadcast_id,kind,ref,phone,name,donor_id,member_id,body,vars,send_after,manual)
      values(b,p_kind,nullif(x->>'ref',''),ph,x->>'name',nullif(x->>'donor_id','')::uuid,nullif(x->>'member_id','')::uuid,left(x->>'body',4000),x->'vars',at,coalesce(p_manual,false))
      on conflict do nothing;
    if found then n:=n+1; else skipped:=skipped+1; end if;
  end loop;
  update wa_broadcasts set total=n where id=b;
  return jsonb_build_object('broadcast_id',b,'broadcast_no',bno,'queued',n,'skipped',skipped,'send_after',at,'manual',coalesce(p_manual,false)); end $$;

create or replace function wa_claim(p_limit int default 1) returns setof wa_outbox language plpgsql security definer set search_path=public as $$
declare w wa_settings; done_today int; quiet boolean; begin
  select * into w from wa_settings where id=1;
  update wa_outbox set status='queued' where status='sending' and claimed_at<now()-interval '10 minutes';
  if w.provider not in ('qr','cloud') then return; end if;
  quiet := wa_next_slot(now())>now();
  select count(*) into done_today from wa_outbox where status='sent' and sent_at>=(wa_ist_today()::timestamp at time zone 'Asia/Kolkata');
  if done_today>=w.daily_cap then return; end if;
  return query update wa_outbox o set status='sending', attempts=o.attempts+1, provider=w.provider, claimed_at=now()
    where o.id in (select id from wa_outbox where status='queued' and not manual and send_after<=now() and (not quiet or kind='emergency')
                   and not exists(select 1 from wa_optout x where x.phone=wa_outbox.phone and x.active)
                   order by (kind='emergency') desc, send_after, created_at limit least(p_limit, w.daily_cap-done_today) for update skip locked)
    returning o.*;
end $$;
revoke execute on function wa_claim(int) from public, anon, authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function wa_claim(int) to service_role; end if; end $$;
