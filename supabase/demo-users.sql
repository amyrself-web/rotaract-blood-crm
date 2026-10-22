-- Creates 4 demo logins (coordinator, medical, volunteer, donor) for testing roles.
-- 1. Change the password on the next line (min 8 characters). 2. Run in Supabase SQL Editor.
-- Remove them later with demo-users-remove.sql.
do $$
declare
  pw text := 'Change-Me-2026';   -- <== put your own password here
  u record; new_id uuid;
begin
  for u in select * from (values
    ('demo.coordinator@rotractclubsge.com','Demo Coordinator','coordinator'),
    ('demo.medical@rotractclubsge.com','Demo Medical','medical'),
    ('demo.volunteer@rotractclubsge.com','Demo Volunteer','volunteer'),
    ('demo.donor@rotractclubsge.com','Demo Donor','donor')) v(email,name,role)
  loop
    if exists(select 1 from auth.users where email=u.email) then continue; end if;
    new_id := gen_random_uuid();
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values('00000000-0000-0000-0000-000000000000',new_id,'authenticated','authenticated',u.email,
      extensions.crypt(pw,extensions.gen_salt('bf')),now(),
      '{"provider":"email","providers":["email"]}',jsonb_build_object('full_name',u.name),now(),now(),'','','','');
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values(gen_random_uuid(),new_id,new_id::text,jsonb_build_object('sub',new_id::text,'email',u.email,'email_verified',true),'email',now(),now(),now());
    update public.profiles set role=u.role::app_role, full_name=u.name where id=new_id;
  end loop;
end $$;
select u.email, p.role from auth.users u join public.profiles p on p.id=u.id where u.email like 'demo.%' order by 2;
