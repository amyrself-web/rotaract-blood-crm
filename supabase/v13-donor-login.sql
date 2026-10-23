-- v13: safer and more useful donor login. Run once, after v12.
--  * linking a login to a donor or member record by mobile + date of birth is limited to 5 wrong tries an hour
--  * a new donor can create their own donor record from the portal (no camp visit needed first)
--  * donors can update their email and area, and see urgent requests for their blood group

create table if not exists claim_attempts(
  id bigint generated always as identity primary key,
  user_id uuid not null, kind text not null, ok boolean not null, at timestamptz not null default now());
create index if not exists claim_attempts_user on claim_attempts(user_id, at desc);
alter table claim_attempts enable row level security;   -- written only by the functions below

create or replace function claim_throttle(p_kind text) returns void language plpgsql security definer set search_path=public as $$
begin
  if (select count(*) from claim_attempts where user_id=auth.uid() and not ok and at>now()-interval '1 hour')>=5 then
    raise exception 'Too many wrong tries. Please wait an hour, or ask the club to link your record.'; end if; end $$;

-- returns 'ok', or the reason it did not match (not an error, so the wrong try is remembered)
create or replace function claim_donor(p_phone text, p_dob date, p_consent boolean) returns text language plpgsql security definer set search_path=public as $$
declare n int; ph text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),10); begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not p_consent then raise exception 'Please agree to be contacted'; end if;
  if exists(select 1 from donors where user_id=auth.uid() and deleted_at is null) then return 'ok'; end if;
  perform claim_throttle('donor');
  update donors set user_id=auth.uid(), consent=true, consent_at=coalesce(consent_at,now())
    where phone=ph and dob=p_dob and user_id is null and deleted_at is null;
  get diagnostics n = row_count;
  insert into claim_attempts(user_id,kind,ok) values(auth.uid(),'donor',n>0);
  if n=0 then return 'No donor record matches that mobile number and date of birth. New donor? Use "I am a new donor" below.'; end if;
  return 'ok'; end $$;

create or replace function claim_member(p_phone text, p_dob date) returns jsonb language plpgsql security definer set search_path=public as $$
declare m members; ph text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),10); bad text; begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists(select 1 from members where profile_id=auth.uid() and deleted_at is null) then raise exception 'Your login is already linked to a member record'; end if;
  perform claim_throttle('member');
  select * into m from members where phone=ph and deleted_at is null and status<>'resigned' order by member_no limit 1;
  bad := case when m.id is null or m.dob is null or m.dob<>p_dob then 'Mobile number and date of birth do not match our records. Ask the club secretary to check them.'
              when m.profile_id is not null then 'This member record is already linked to another login. Ask the club secretary.' end;
  insert into claim_attempts(user_id,kind,ok) values(auth.uid(),'member',bad is null);
  if bad is not null then return jsonb_build_object('error',bad); end if;
  update members set profile_id=auth.uid() where id=m.id;
  perform set_config('app.claiming','1',true);
  update profiles set role='member', designation=coalesce(designation,m.position), full_name=coalesce(full_name,m.full_name), phone=coalesce(phone,m.phone)
    where id=auth.uid() and role='donor';
  perform set_config('app.claiming','',true);
  return jsonb_build_object('member_no',m.member_no,'name',m.full_name); end $$;

-- a new donor signs up and fills in their own details
create or replace function create_my_donor(p_name text, p_phone text, p_dob date, p_gender text, p_group blood_group, p_area text, p_consent boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare ph text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),10); d donors; begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists(select 1 from donors where user_id=auth.uid() and deleted_at is null) then raise exception 'Your login already has a donor record'; end if;
  if not coalesce(p_consent,false) then raise exception 'Please agree to be contacted'; end if;
  if p_dob is null or p_dob > current_date - interval '18 years' or p_dob < current_date - interval '65 years' then raise exception 'Donors must be 18 to 65 years old'; end if;
  if p_gender not in ('Male','Female','Other') then raise exception 'Choose your gender'; end if;
  if exists(select 1 from donors where phone=ph) then raise exception 'This mobile number is already registered with the club. Use "Find my record" with your date of birth.'; end if;
  insert into donors(full_name,phone,dob,gender,blood_group,area,consent,consent_at,source,user_id,email)
    values(trim(p_name),ph,p_dob,p_gender,p_group,nullif(trim(coalesce(p_area,'')),''),true,now(),'self',auth.uid(),(select email from auth.users where id=auth.uid() and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
    returning * into d;
  update profiles set full_name=coalesce(nullif(full_name,''),d.full_name), phone=coalesce(phone,d.phone) where id=auth.uid();
  return jsonb_build_object('donor_no',d.donor_no); end $$;

create or replace function update_my_donor(p_email text, p_area text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from donors where user_id=auth.uid() and deleted_at is null) then raise exception 'Link your donor record first'; end if;
  if p_email is not null and p_email<>'' and p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  update donors set email=nullif(trim(p_email),''), area=nullif(trim(p_area),'') where user_id=auth.uid() and deleted_at is null; end $$;

-- open emergency requests that match the donor's blood group (hospital and the contact to call, nothing about the patient)
create or replace function my_urgent() returns jsonb language plpgsql security definer set search_path=public as $$
declare d donors; begin
  select * into d from donors where user_id=auth.uid() and deleted_at is null;
  if d.id is null or d.blood_group is null then return '[]'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('group',r.blood_group,'units',r.units_needed,'hospital',r.hospital,'contact',r.contact_name,'phone',r.contact_phone,'at',r.created_at) order by r.created_at desc)
    from emergency_requests r where r.status='open' and r.deleted_at is null and r.blood_group=d.blood_group and r.created_at>now()-interval '7 days'),'[]'); end $$;

grant execute on function claim_donor(text,date,boolean), claim_member(text,date), create_my_donor(text,text,date,text,blood_group,text,boolean), update_my_donor(text,text), my_urgent() to authenticated;
revoke execute on function claim_donor(text,date,boolean), claim_member(text,date), create_my_donor(text,text,date,text,blood_group,text,boolean), update_my_donor(text,text), my_urgent(), claim_throttle(text) from public, anon;
revoke execute on function claim_throttle(text) from authenticated;
