-- v6: logins for club members. Members edit their own details, mark attendance with the meeting code or QR,
-- apply for leave, see minutes, their action items, dues and attendance. Run once, after v5. Nothing is dropped.

-- Part 1 (run on its own first): the new role
alter type app_role add value if not exists 'member';

-- Part 2
alter table meetings add column if not exists checkin_code text;
update meetings set checkin_code=lpad((floor(random()*1000000))::int::text,6,'0') where checkin_code is null;
alter table meetings alter column checkin_code set default lpad((floor(random()*1000000))::int::text,6,'0');
alter table meeting_attendance add column if not exists note text;
alter table meeting_attendance add column if not exists self_marked boolean not null default false;

create or replace function my_member() returns members language sql stable security definer set search_path=public as $$
  select * from members where profile_id=auth.uid() and deleted_at is null limit 1 $$;

create or replace function my_access() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('role',p.role,'designation',p.designation,'active',p.active,
    'member',exists(select 1 from members m where m.profile_id=p.id and m.deleted_at is null),
    'perms',(select jsonb_object_agg(m, case when p.role='admin' then true when p.permissions ? m then (p.permissions->>m)::boolean else m=any(role_default_perms(p.role)) end)
             from unnest(role_default_perms('admin')) m))
  from profiles p where p.id=auth.uid() $$;

-- people may change their own role only through claim_member (donor -> member)
create or replace function guard_profile() returns trigger language plpgsql security definer set search_path=public as $$
declare me profiles; begin
  if auth.uid() is null then return coalesce(new,old); end if;
  select * into me from profiles where id=auth.uid();
  if tg_op='DELETE' then raise exception 'Remove users from the Users page'; end if;
  if not perm('users') and new.id<>auth.uid() then raise exception 'You do not have permission to manage users'; end if;
  if new.id=auth.uid() and not perm('users') then
    if coalesce(current_setting('app.claiming',true),'')='1' and old.role='donor' and new.role='member'
       and new.active=old.active and new.permissions=old.permissions then return new; end if;
    if new.role<>old.role or new.active<>old.active or new.permissions<>old.permissions or new.designation is distinct from old.designation
      then raise exception 'You can only change your own name and phone'; end if;
    return new; end if;
  if me.role<>'admin' and (old.role='admin' or new.role='admin') then raise exception 'Only an admin can change admin accounts'; end if;
  if old.role='admin' and (new.role<>'admin' or not new.active)
     and not exists(select 1 from profiles where role='admin' and active and id<>old.id) then raise exception 'Keep at least one active admin'; end if;
  new.updated_at:=now(); return new; end $$;

-- A signed-in person links themself to their member record using mobile number and date of birth.
create or replace function claim_member(p_phone text, p_dob date) returns jsonb language plpgsql security definer set search_path=public as $$
declare m members; ph text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),10); begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists(select 1 from members where profile_id=auth.uid() and deleted_at is null) then raise exception 'Your login is already linked to a member record'; end if;
  select * into m from members where phone=ph and deleted_at is null and status<>'resigned' order by member_no limit 1;
  if m.id is null then raise exception 'No member found with this mobile number. Ask the club secretary to add you first.'; end if;
  if m.dob is null then raise exception 'Your date of birth is not on record. Ask the club secretary to add it, then try again.'; end if;
  if m.dob<>p_dob then raise exception 'Mobile number and date of birth do not match our records'; end if;
  if m.profile_id is not null then raise exception 'This member record is already linked to another login. Ask the club secretary.'; end if;
  update members set profile_id=auth.uid() where id=m.id;
  perform set_config('app.claiming','1',true);
  update profiles set role='member', designation=coalesce(designation,m.position), full_name=coalesce(full_name,m.full_name), phone=coalesce(phone,m.phone)
    where id=auth.uid() and role='donor';
  perform set_config('app.claiming','',true);
  return jsonb_build_object('member_no',m.member_no,'name',m.full_name); end $$;

-- Everything a member sees on their own page
create or replace function my_club() returns jsonb language plpgsql security definer set search_path=public as $$
declare m members; ry_from date; ry_to date; begin
  select * into m from members where profile_id=auth.uid() and deleted_at is null limit 1;
  if m.id is null then return null; end if;
  ry_from := make_date(case when extract(month from current_date)>=7 then extract(year from current_date)::int else extract(year from current_date)::int-1 end,7,1);
  ry_to := ry_from + interval '1 year' - interval '1 day';
  return jsonb_build_object(
    'me',jsonb_build_object('id',m.id,'member_no',m.member_no,'full_name',m.full_name,'phone',m.phone,'email',m.email,'dob',m.dob,'gender',m.gender,'blood_group',m.blood_group,
      'address',m.address,'area',m.area,'occupation',m.occupation,'organisation',m.organisation,'position',m.position,'membership_type',m.membership_type,'status',m.status,
      'joined_on',m.joined_on,'emergency_contact',m.emergency_contact,'donor_no',(select donor_no from donors where id=m.donor_id)),
    'year',jsonb_build_object('from',ry_from,'to',ry_to),
    'attendance',(select jsonb_build_object(
        'held',count(*),'present',count(*) filter (where a.status in ('present','late')),'leave',count(*) filter (where a.status='leave'))
      from meetings mt left join meeting_attendance a on a.meeting_id=mt.id and a.member_id=m.id
      where mt.status='held' and mt.deleted_at is null and mt.meeting_date between greatest(ry_from,coalesce(m.joined_on,ry_from)) and ry_to),
    'upcoming',coalesce((select jsonb_agg(jsonb_build_object('id',mt.id,'no',mt.meeting_no,'kind',mt.kind,'title',mt.title,'date',mt.meeting_date,'start',mt.start_time,'end',mt.end_time,
        'venue',mt.venue,'mode',mt.mode,'link',mt.online_link,'agenda',mt.agenda,'chief_guest',mt.chief_guest,'my',a.status,'note',a.note) order by mt.meeting_date, mt.start_time)
      from meetings mt left join meeting_attendance a on a.meeting_id=mt.id and a.member_id=m.id
      where mt.deleted_at is null and mt.status='scheduled' and mt.meeting_date>=(now() at time zone 'Asia/Kolkata')::date),'[]'::jsonb),
    'recent',coalesce((select jsonb_agg(x order by x->>'date' desc) from (select jsonb_build_object('id',mt.id,'no',mt.meeting_no,'kind',mt.kind,'title',mt.title,'date',mt.meeting_date,
        'venue',mt.venue,'minutes',mt.minutes,'decisions',mt.decisions,'chief_guest',mt.chief_guest,'my',coalesce(a.status,'absent'),
        'present',(select count(*) from meeting_attendance z where z.meeting_id=mt.id and z.status in ('present','late'))) x
      from meetings mt left join meeting_attendance a on a.meeting_id=mt.id and a.member_id=m.id
      where mt.deleted_at is null and mt.status='held' order by mt.meeting_date desc limit 12) s),'[]'::jsonb),
    'actions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'task',x.task,'due',x.due,'done',x.done,'meeting',mt.title,'meeting_no',mt.meeting_no) order by x.done, x.due nulls last)
      from meeting_actions x join meetings mt on mt.id=x.meeting_id where x.owner_member=m.id and mt.deleted_at is null),'[]'::jsonb),
    'dues',coalesce((select jsonb_agg(jsonb_build_object('receipt_no',d.receipt_no,'period',d.period,'amount',d.amount,'paid_on',d.paid_on,'mode',d.mode) order by d.paid_on desc)
      from member_dues d where d.member_id=m.id),'[]'::jsonb),
    'team',coalesce((select jsonb_agg(jsonb_build_object('name',x.full_name,'position',x.position,'phone',case when x.position<>'Member' then x.phone end) order by x.member_no)
      from members x where x.deleted_at is null and x.status='active' and x.membership_type in ('Active','Honorary')),'[]'::jsonb),
    'camps',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'date',c.camp_date,'venue',c.venue,'status',c.status,'start',c.start_time) order by c.camp_date)
      from camps c where c.deleted_at is null and c.status in ('planned','open','live') and c.camp_date>=(now() at time zone 'Asia/Kolkata')::date),'[]'::jsonb),
    'donations',case when m.donor_id is null then null else (select count(*) from donations n join registrations r on r.id=n.registration_id where r.donor_id=m.donor_id)
      +(select coalesce(sum(coalesce(units,1)),0) from donor_events where donor_id=m.donor_id and kind in ('outside_donation','emergency_donation')) end);
end $$;

-- Members may update only their own contact and personal details (not position, type or status)
create or replace function update_my_member(p jsonb) returns void language plpgsql security definer set search_path=public as $$
declare m members := my_member(); begin
  if m.id is null then raise exception 'Your login is not linked to a member record'; end if;
  update members set
    phone=coalesce(nullif(right(regexp_replace(coalesce(p->>'phone',''),'\D','','g'),10),''),phone),
    email=case when p ? 'email' then nullif(trim(p->>'email'),'') else email end,
    dob=coalesce(nullif(p->>'dob','')::date,dob), gender=case when p ? 'gender' then nullif(p->>'gender','') else gender end,
    blood_group=case when p ? 'blood_group' then nullif(p->>'blood_group','')::blood_group else blood_group end,
    address=case when p ? 'address' then nullif(trim(p->>'address'),'') else address end,
    area=case when p ? 'area' then nullif(trim(p->>'area'),'') else area end,
    occupation=case when p ? 'occupation' then nullif(p->>'occupation','') else occupation end,
    organisation=case when p ? 'organisation' then nullif(trim(p->>'organisation'),'') else organisation end,
    emergency_contact=case when p ? 'emergency_contact' then nullif(trim(p->>'emergency_contact'),'') else emergency_contact end
  where id=m.id; end $$;

-- Self check-in: the code shown at the meeting, on the meeting day only
create or replace function member_checkin(p_meeting uuid, p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare m members := my_member(); mt meetings; now_ist timestamp := (now() at time zone 'Asia/Kolkata'); st text; cur text; begin
  if m.id is null then raise exception 'Your login is not linked to a member record'; end if;
  if p_meeting is null then select * into mt from meetings where deleted_at is null and status<>'cancelled' and meeting_date=now_ist::date and checkin_code=trim(p_code) limit 1;
  else select * into mt from meetings where id=p_meeting and deleted_at is null; end if;
  if mt.id is null then raise exception 'No meeting today matches this code'; end if;
  if mt.status='cancelled' then raise exception 'This meeting was cancelled'; end if;
  if mt.checkin_code is distinct from trim(coalesce(p_code,'')) then raise exception 'Wrong check-in code. Ask the secretary for today''s code.'; end if;
  if mt.meeting_date<>now_ist::date then raise exception 'Check-in is open only on the meeting day (%)', to_char(mt.meeting_date,'DD Mon YYYY'); end if;
  if mt.start_time is not null and now_ist < (mt.meeting_date + mt.start_time - interval '60 minutes') then
    raise exception 'Check-in opens one hour before the meeting (% )', to_char(mt.start_time,'HH24:MI'); end if;
  if mt.end_time is not null and now_ist > (mt.meeting_date + mt.end_time + interval '60 minutes') then raise exception 'Check-in for this meeting has closed'; end if;
  select status into cur from meeting_attendance where meeting_id=mt.id and member_id=m.id;
  if cur in ('present','late') then return jsonb_build_object('status',cur,'title',mt.title,'already',true); end if;
  st := case when mt.start_time is not null and now_ist > (mt.meeting_date + mt.start_time + interval '15 minutes') then 'late' else 'present' end;
  insert into meeting_attendance(meeting_id,member_id,status,self_marked,noted_at) values(mt.id,m.id,st,true,now())
    on conflict (meeting_id,member_id) do update set status=excluded.status, self_marked=true, noted_at=now(), note=null;
  return jsonb_build_object('status',st,'title',mt.title,'already',false); end $$;

-- Apply for leave for a meeting that has not happened yet (or is today)
create or replace function member_leave(p_meeting uuid, p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare m members := my_member(); mt meetings; cur text; begin
  if m.id is null then raise exception 'Your login is not linked to a member record'; end if;
  select * into mt from meetings where id=p_meeting and deleted_at is null;
  if mt.id is null or mt.status<>'scheduled' then raise exception 'Leave can be applied only for an upcoming meeting'; end if;
  if mt.meeting_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'This meeting is over'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Write a short reason for leave'; end if;
  select status into cur from meeting_attendance where meeting_id=mt.id and member_id=m.id;
  if cur in ('present','late') then raise exception 'You are already marked present for this meeting'; end if;
  insert into meeting_attendance(meeting_id,member_id,status,note,self_marked) values(mt.id,m.id,'leave',trim(p_reason),true)
    on conflict (meeting_id,member_id) do update set status='leave', note=trim(p_reason), self_marked=true, noted_at=now(); end $$;

-- Changed your mind after applying for leave? Just check in on the day; it replaces the leave.
create or replace function member_action_done(p_action uuid, p_done boolean) returns void language plpgsql security definer set search_path=public as $$
declare m members := my_member(); begin
  if m.id is null then raise exception 'Your login is not linked to a member record'; end if;
  update meeting_actions set done=p_done where id=p_action and owner_member=m.id;
  if not found then raise exception 'This action item is not assigned to you'; end if; end $$;

revoke execute on function my_member(), claim_member(text,date), my_club(), update_my_member(jsonb), member_checkin(uuid,text), member_leave(uuid,text),
  member_action_done(uuid,boolean) from public, anon;
grant execute on function my_member(), claim_member(text,date), my_club(), update_my_member(jsonb), member_checkin(uuid,text), member_leave(uuid,text),
  member_action_done(uuid,boolean) to authenticated;
