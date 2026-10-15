-- Phase 5: donor portal, certificates, public landing page. Run once (after phase4.sql)
alter table donors add column user_id uuid unique references auth.users on delete set null;

-- Donor links their login to their donor record with mobile number + date of birth
create function claim_donor(p_phone text,p_dob date,p_consent boolean) returns text
language plpgsql security definer set search_path=public as $$
declare n int; begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not p_consent then raise exception 'Please agree to be contacted'; end if;
  if exists(select 1 from donors where user_id=auth.uid()) then return 'ok'; end if;
  update donors set user_id=auth.uid(), consent=true, consent_at=coalesce(consent_at,now())
    where phone=p_phone and dob=p_dob and user_id is null;
  get diagnostics n = row_count;
  if n=0 then raise exception 'No donor record matches that mobile number and date of birth'; end if;
  return 'ok'; end $$;

-- Everything the donor dashboard needs, in one call
create function my_portal() returns jsonb
language plpgsql security definer set search_path=public as $$
declare d donors; begin
  select * into d from donors where user_id=auth.uid();
  return jsonb_build_object(
    'donor', case when d.id is null then null else jsonb_build_object('name',d.full_name,'blood_group',d.blood_group,'gender',d.gender,'last_donation',d.last_donation) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('code',upper(left(r.id::text,8)),'camp',c.name,'date',c.camp_date,'volume',n.volume_ml) order by c.camp_date desc)
      from registrations r join donations n on n.registration_id=r.id join camps c on c.id=r.camp_id where r.donor_id=d.id),'[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('camp_id',c.id,'camp',c.name,'date',c.camp_date,'venue',c.venue,'slot',r.slot) order by c.camp_date)
      from registrations r join camps c on c.id=r.camp_id where r.donor_id=d.id and r.status in ('registered','checked_in') and c.status in ('open','live','planned')),'[]'::jsonb),
    'open_camps', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'date',c.camp_date,'venue',c.venue,'start_time',c.start_time,'end_time',c.end_time) order by c.camp_date)
      from camps c where c.status='open'),'[]'::jsonb));
end $$;

create function register_me(p_camp uuid,p_slot text) returns text
language plpgsql security definer set search_path=public as $$
declare d uuid; begin
  select id into d from donors where user_id=auth.uid();
  if d is null then raise exception 'Link your donor record first'; end if;
  if not exists(select 1 from camps where id=p_camp and status='open') then raise exception 'Registration for this camp is closed'; end if;
  insert into registrations(camp_id,donor_id,slot) values(p_camp,d,p_slot)
  on conflict (camp_id,donor_id) do update set slot=excluded.slot where registrations.status='registered';
  return 'ok'; end $$;

-- Public: checks a certificate code from the QR. Shows only first name, initial, camp and date.
create function verify_certificate(p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r jsonb; begin
  if length(p_code)<>8 then return jsonb_build_object('error','not found'); end if;
  select jsonb_build_object('name',trim(split_part(d.full_name,' ',1)||' '||left(regexp_replace(d.full_name,'^\S+\s*',''),1)),'camp',c.name,'date',c.camp_date) into r
  from registrations rg join donations n on n.registration_id=rg.id join donors d on d.id=rg.donor_id join camps c on c.id=rg.camp_id
  where upper(left(rg.id::text,8))=upper(p_code) limit 1;
  return coalesce(r,jsonb_build_object('error','not found')); end $$;

-- Public: next open or live camp with live counters (no personal data)
create function public_camp_info() returns jsonb
language plpgsql security definer set search_path=public as $$
declare r jsonb; begin
  select jsonb_build_object('id',c.id,'name',c.name,'date',c.camp_date,'start_time',c.start_time,'end_time',c.end_time,'venue',c.venue,'status',c.status,'target',c.target_donors,
    'registered',(select count(*) from registrations where camp_id=c.id),'donated',(select count(*) from registrations where camp_id=c.id and status='donated')) into r
  from camps c where c.status in ('open','live') order by abs(c.camp_date-current_date) limit 1;
  return r; end $$;
grant execute on function claim_donor, my_portal, register_me to authenticated;
grant execute on function verify_certificate, public_camp_info to anon, authenticated;
