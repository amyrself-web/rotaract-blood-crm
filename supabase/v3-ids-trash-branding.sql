-- v3: serial numbers, recycle bin (soft delete), branding, live updates. Run once, after v2-permissions.sql.

-- ---------- serial numbers ----------
create sequence if not exists donor_no_seq;
create sequence if not exists camp_no_seq;
create sequence if not exists member_no_seq;
create sequence if not exists request_no_seq;
alter table donors add column if not exists donor_no int;
alter table camps add column if not exists camp_no int;
alter table profiles add column if not exists member_no int;
alter table emergency_requests add column if not exists req_no int;
alter table registrations add column if not exists token_no int;
update donors t set donor_no=x.n from (select id,row_number() over(order by created_at,id) n from donors) x where x.id=t.id and t.donor_no is null;
update camps t set camp_no=x.n from (select id,row_number() over(order by created_at,id) n from camps) x where x.id=t.id and t.camp_no is null;
update profiles t set member_no=x.n from (select id,row_number() over(order by created_at,id) n from profiles) x where x.id=t.id and t.member_no is null;
update emergency_requests t set req_no=x.n from (select id,row_number() over(order by created_at,id) n from emergency_requests) x where x.id=t.id and t.req_no is null;
update registrations t set token_no=x.n from (select id,row_number() over(partition by camp_id order by created_at,id) n from registrations) x where x.id=t.id and t.token_no is null;
select setval('donor_no_seq',coalesce((select max(donor_no) from donors),0)+1,false);
select setval('camp_no_seq',coalesce((select max(camp_no) from camps),0)+1,false);
select setval('member_no_seq',coalesce((select max(member_no) from profiles),0)+1,false);
select setval('request_no_seq',coalesce((select max(req_no) from emergency_requests),0)+1,false);
alter table donors alter column donor_no set default nextval('donor_no_seq');
alter table camps alter column camp_no set default nextval('camp_no_seq');
alter table profiles alter column member_no set default nextval('member_no_seq');
alter table emergency_requests alter column req_no set default nextval('request_no_seq');
alter sequence donor_no_seq owned by donors.donor_no;
alter sequence camp_no_seq owned by camps.camp_no;
alter sequence member_no_seq owned by profiles.member_no;
alter sequence request_no_seq owned by emergency_requests.req_no;
create unique index if not exists donors_donor_no on donors(donor_no);
create unique index if not exists camps_camp_no on camps(camp_no);
create unique index if not exists profiles_member_no on profiles(member_no);
create unique index if not exists emergency_requests_req_no on emergency_requests(req_no);
grant usage on sequence donor_no_seq, camp_no_seq, member_no_seq, request_no_seq to authenticated;

-- token number per camp: 1, 2, 3 ... in the order people register
create or replace function set_token_no() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.token_no is null then
    perform pg_advisory_xact_lock(hashtext(new.camp_id::text));
    select coalesce(max(token_no),0)+1 into new.token_no from registrations where camp_id=new.camp_id;
  end if;
  return new; end $$;
create or replace trigger registrations_token before insert on registrations for each row execute function set_token_no();

-- ---------- recycle bin: deleting donors, camps and requests only hides them ----------
alter table donors add column if not exists deleted_at timestamptz;
alter table donors add column if not exists deleted_by uuid;
alter table camps add column if not exists deleted_at timestamptz;
alter table camps add column if not exists deleted_by uuid;
alter table emergency_requests add column if not exists deleted_at timestamptz;
alter table emergency_requests add column if not exists deleted_by uuid;
alter policy "public read open camps" on camps using (status='open' and deleted_at is null);

create or replace function register_for_camp(p_camp uuid,p_name text,p_phone text,p_group blood_group,p_dob date,p_area text,p_slot text,p_consent boolean)
returns text language plpgsql security definer set search_path=public as $$
declare d uuid; begin
  if not p_consent then raise exception 'Consent is required'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Enter your full name'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number'; end if;
  if p_dob is null or p_dob > current_date - interval '18 years' or p_dob < current_date - interval '66 years' then raise exception 'Donors must be 18 to 65 years old'; end if;
  if not exists(select 1 from camps where id=p_camp and status='open' and deleted_at is null) then raise exception 'Registration for this camp is closed'; end if;
  if slot_is_full(p_camp,p_slot) then raise exception 'This time slot is full. Choose another slot.'; end if;
  insert into donors(full_name,phone,blood_group,dob,area,consent,consent_at,source)
  values(trim(p_name),p_phone,p_group,p_dob,nullif(trim(p_area),''),true,now(),'public_form')
  on conflict(phone) do update set consent=true, consent_at=coalesce(donors.consent_at,now()), deleted_at=null, deleted_by=null returning id into d;
  insert into registrations(camp_id,donor_id,slot) values(p_camp,d,p_slot) on conflict do nothing;
  return 'ok'; end $$;

create or replace function register_me(p_camp uuid,p_slot text) returns text
language plpgsql security definer set search_path=public as $$
declare d uuid; begin
  select id into d from donors where user_id=auth.uid() and deleted_at is null;
  if d is null then raise exception 'Link your donor record first'; end if;
  if not exists(select 1 from camps where id=p_camp and status='open' and deleted_at is null) then raise exception 'Registration for this camp is closed'; end if;
  if slot_is_full(p_camp,p_slot) then raise exception 'This time slot is full. Choose another slot.'; end if;
  insert into registrations(camp_id,donor_id,slot) values(p_camp,d,p_slot)
  on conflict (camp_id,donor_id) do update set slot=excluded.slot where registrations.status='registered';
  return 'ok'; end $$;

create or replace function walk_in(p_camp uuid,p_name text,p_phone text,p_group blood_group,p_dob date,p_area text,p_consent boolean) returns text
language plpgsql security definer set search_path=public as $$
declare d uuid; begin
  if not perm('campday') then raise exception 'Not allowed'; end if;
  if not p_consent then raise exception 'Consent is required'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Enter the full name'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number'; end if;
  if p_dob is null or p_dob > current_date - interval '18 years' or p_dob < current_date - interval '66 years' then raise exception 'Donors must be 18 to 65 years old'; end if;
  if not exists(select 1 from camps where id=p_camp and status in ('open','live') and deleted_at is null) then raise exception 'This camp is not open'; end if;
  insert into donors(full_name,phone,blood_group,dob,area,consent,consent_at,source)
  values(trim(p_name),p_phone,p_group,p_dob,nullif(trim(p_area),''),true,now(),'walk_in')
  on conflict(phone) do update set consent=true, consent_at=coalesce(donors.consent_at,now()), deleted_at=null, deleted_by=null returning id into d;
  insert into registrations(camp_id,donor_id,status) values(p_camp,d,'checked_in')
  on conflict (camp_id,donor_id) do update set status='checked_in' where registrations.status in ('registered','no_show');
  return 'ok'; end $$;

do $$ declare src text; begin
  select pg_get_functiondef('public.public_camp_info()'::regprocedure) into src;
  src := replace(src, 'from camps c where c.status in (''open'',''live'') order by', 'from camps c where c.status in (''open'',''live'') and c.deleted_at is null order by');
  execute src;
  select pg_get_functiondef('public.my_portal()'::regprocedure) into src;
  src := replace(src, 'from camps c where c.status=''open'')', 'from camps c where c.status=''open'' and c.deleted_at is null)');
  src := replace(src, 'select * into d from donors where user_id=auth.uid();', 'select * into d from donors where user_id=auth.uid() and deleted_at is null;');
  execute src;
  select pg_get_functiondef('public.claim_donor(text,date,boolean)'::regprocedure) into src;
  src := replace(src, 'where phone=p_phone and dob=p_dob and user_id is null;', 'where phone=p_phone and dob=p_dob and user_id is null and deleted_at is null;');
  execute src;
end $$;

-- ---------- branding ----------
alter table settings add column if not exists brand_name text not null default 'Rotaract Blood';
alter table settings add column if not exists tagline text default 'Sankari donor CRM';
alter table settings add column if not exists logo_url text;
alter table settings add column if not exists brand_color text not null default '#4C8DFF';
alter table settings add column if not exists address text;
alter table settings add column if not exists contact_phone text;
alter table settings add column if not exists contact_email text;
alter table settings add column if not exists signatory_name text;
alter table settings add column if not exists signatory_title text default 'President';
do $$ begin if not exists(select 1 from pg_constraint where conname='settings_brand_color_hex') then
  alter table settings add constraint settings_brand_color_hex check (brand_color ~ '^#[0-9A-Fa-f]{6}$'); end if; end $$;

-- public pages (login, registration, certificate check) need the brand without signing in
create or replace function public_brand() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('brand_name',brand_name,'tagline',tagline,'logo_url',logo_url,'brand_color',brand_color,'club_name',club_name,
    'address',address,'contact_phone',contact_phone,'contact_email',contact_email,'signatory_name',signatory_name,'signatory_title',signatory_title)
  from settings where id=1 $$;
grant execute on function public_brand() to anon, authenticated;

create or replace function verify_certificate(p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r jsonb; begin
  if length(coalesce(p_code,''))<>8 then return jsonb_build_object('error','not found'); end if;
  select jsonb_build_object('name',trim(split_part(d.full_name,' ',1)||' '||left(regexp_replace(d.full_name,'^\S+\s*',''),1)),
    'camp',c.name,'date',c.camp_date,'venue',c.venue,'blood_group',d.blood_group,'volume',n.volume_ml,'code',upper(left(rg.id::text,8)),
    'donor_no',d.donor_no,'club',(select club_name from settings where id=1)) into r
  from registrations rg join donations n on n.registration_id=rg.id join donors d on d.id=rg.donor_id join camps c on c.id=rg.camp_id
  where upper(left(rg.id::text,8))=upper(p_code) limit 1;
  return coalesce(r,jsonb_build_object('error','not found')); end $$;
grant execute on function verify_certificate(text) to anon, authenticated;

-- logo storage (Supabase only)
do $$ begin
  if exists(select 1 from pg_namespace where nspname='storage') then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('branding','branding',true,2097152,array['image/png','image/jpeg','image/webp']) on conflict (id) do nothing;
    if not exists(select 1 from pg_policies where schemaname='storage' and policyname='branding upload') then
      create policy "branding upload" on storage.objects for insert to authenticated with check (bucket_id='branding' and public.perm('settings'));
      create policy "branding replace" on storage.objects for update to authenticated using (bucket_id='branding' and public.perm('settings'));
    end if;
  end if; end $$;

-- ---------- live updates (Supabase Realtime) ----------
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['donors','camps','registrations','donations','blood_units','handovers','emergency_requests','tasks','camp_volunteers',
                             'sponsors','expenses','profiles','settings','message_log','audit_logs','stock_thresholds'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if; end $$;
