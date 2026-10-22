-- Sample data for trying the CRM: 4 demo logins + 40 donors, 3 camps, donations, stock, team and money.
-- Run AFTER schema.sql, phase2 to phase8 and fix-01. Change the password below first.
-- Edit the records into real ones later, or remove everything with sample-data-remove.sql.
-- Sample phone numbers are made up (90000 000xx). Do not send WhatsApp messages to them.
do $$ begin
  if exists(select 1 from camps where id='c0000000-0000-0000-0000-000000000002') then raise exception 'Sample data is already loaded'; end if;
end $$;
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
insert into camps(id,name,camp_date,start_time,end_time,venue,target_donors,status,budget) values
 ('c0000000-0000-0000-0000-000000000001','Monsoon Blood Drive',current_date-75,'09:00','14:00','Govt Hospital, Sankari',30,'completed',15000),
 ('c0000000-0000-0000-0000-000000000002','Sankari Mega Blood Donation Camp',current_date+7,'09:00','15:00','Rotary Hall, Sankari',50,'open',25000),
 ('c0000000-0000-0000-0000-000000000003','College Blood Drive',current_date+30,'10:00','13:00','Vivekanandha College, Tiruchengode',40,'planned',12000);
with n(i,name,g,gen) as (values
 (1,'Ravi Kumar','O+','Male'),(2,'Lakshmi Narayanan','B+','Male'),(3,'Meena Devi','A+','Female'),(4,'Saravanan P','O+','Male'),(5,'Kavya R','AB+','Female'),
 (6,'Muthu Kumar','B+','Male'),(7,'Anitha S','O-','Female'),(8,'Prakash V','A+','Male'),(9,'Deepa M','B-','Female'),(10,'Senthil Nathan','O+','Male'),
 (11,'Gowtham K','A-','Male'),(12,'Revathi P','B+','Female'),(13,'Vignesh R','O+','Male'),(14,'Nandhini S','A+','Female'),(15,'Balaji T','AB-','Male'),
 (16,'Sowmya K','O+','Female'),(17,'Arjun M','B+','Male'),(18,'Keerthana V','A+','Female'),(19,'Hari Prasad','O+','Male'),(20,'Divya Bharathi','B+','Female'),
 (21,'Manikandan S','A+','Male'),(22,'Priyanka R','O+','Female'),(23,'Ramesh Babu','B+','Male'),(24,'Janani K','O-','Female'),(25,'Suresh Kumar','A+','Male'),
 (26,'Pavithra M','AB+','Female'),(27,'Dinesh K','O+','Male'),(28,'Swathi P','B+','Female'),(29,'Ajith Kumar','A-','Male'),(30,'Harini S','O+','Female'),
 (31,'Yuvaraj P','B+','Male'),(32,'Sangeetha R','A+','Female'),(33,'Naveen Kumar','O+','Male'),(34,'Ishwarya T','B-','Female'),(35,'Karthikeyan M','O+','Male'),
 (36,'Abinaya S','A+','Female'),(37,'Sathish R','B+','Male'),(38,'Mohana Priya','O+','Female'),(39,'Tamilarasan K','AB+','Male'),(40,'Vidhya Lakshmi','A+','Female'))
insert into donors(id,full_name,phone,blood_group,gender,dob,area,consent,consent_at,source)
select ('d0000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,name,(9000000000+i)::text,g::blood_group,gen,
  case when i in (3,12) then make_date(1996,extract(month from current_date)::int,extract(day from current_date)::int) else date '1985-01-01'+(i*397) end,
  (array['Sankari','Salem','Edappadi','Tiruchengode','Omalur','Mettur'])[1+i%6], i<=36, case when i<=36 then now() end, 'sample'
from n;
insert into registrations(camp_id,donor_id,slot,status,created_at)
select 'c0000000-0000-0000-0000-000000000001',('d0000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'10:00','donated',now()-interval '80 days' from generate_series(1,18) i;
insert into donations(registration_id,bag_number,volume_ml,created_at)
select r.id,'MBD-'||lpad(row_number() over (order by r.donor_id)::text,3,'0'),350,now()-interval '75 days' from registrations r where r.camp_id='c0000000-0000-0000-0000-000000000001';
update donors set last_donation=current_date-75 where id in (select donor_id from registrations where camp_id='c0000000-0000-0000-0000-000000000001');
update blood_units set source='sample', collected_on=current_date-75, expiry_date=current_date-40,
  status=case when bag_number<='MBD-012' then 'issued' else 'discarded' end, note=case when bag_number<='MBD-012' then 'GH Salem' else 'Expired' end
  where bag_number like 'MBD-%';
insert into registrations(camp_id,donor_id,slot)
select 'c0000000-0000-0000-0000-000000000002',('d0000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,(array['09:00','10:00','11:00','12:00','13:00','14:00'])[1+i%6]
from generate_series(19,40) i where i<=36;
insert into blood_units(bag_number,blood_group,volume_ml,collected_on,expiry_date,source,status) values
 ('GH-1021','O+',350,current_date-30,current_date+5,'sample','available'),('GH-1022','A+',350,current_date-20,current_date+15,'sample','available'),
 ('GH-1023','B+',350,current_date-10,current_date+25,'sample','available'),('GH-1024','O-',350,current_date-33,current_date+2,'sample','available'),
 ('GH-1025','AB+',350,current_date-5,current_date+30,'sample','available'),('GH-1026','A+',350,current_date-8,current_date+27,'sample','available');
insert into emergency_requests(blood_group,units_needed,hospital,contact_name,contact_phone,patient_ref,notes) values
 ('O-',2,'Govt Hospital, Salem','Dr. Selvam','9000000099','SAMPLE','Sample request: surgery tomorrow morning');
insert into tasks(camp_id,title,assignee,due,done) select 'c0000000-0000-0000-0000-000000000002',t,a,current_date+d,d<0 from (values
 ('Permission letter obtained','Arun',-5),('Partner blood bank confirmed','Divya',-3),('Doctors and nurses confirmed','Dr. Priya',-1),('Poster and banners printed','Karthik',1),
 ('Registration QR shared','Divya',2),('Refreshments arranged','Karthik',5),('Volunteers briefed','Arun',6),('Certificates printed','Divya',6)) x(t,a,d);
insert into camp_volunteers(camp_id,name,phone,desk,shift) values
 ('c0000000-0000-0000-0000-000000000002','Karthik R','9000000101','Registration','8 to 12'),('c0000000-0000-0000-0000-000000000002','Pooja S','9000000102','Registration','12 to 4'),
 ('c0000000-0000-0000-0000-000000000002','Vishnu M','9000000103','Screening','8 to 4'),('c0000000-0000-0000-0000-000000000002','Aishwarya K','9000000104','Refreshment','8 to 4'),
 ('c0000000-0000-0000-0000-000000000002','Gokul P','9000000105','Crowd control','8 to 12'),('c0000000-0000-0000-0000-000000000002','Shalini R','9000000106','Certificate','12 to 4');
insert into sponsors(camp_id,name,amount,received) values ('c0000000-0000-0000-0000-000000000002','Sri Murugan Textiles',10000,true),
 ('c0000000-0000-0000-0000-000000000002','Sankari Medicals',5000,true),('c0000000-0000-0000-0000-000000000002','Lakshmi Bakery',3000,false);
insert into expenses(camp_id,category,description,amount) values ('c0000000-0000-0000-0000-000000000002','Refreshments','Juice and biscuits',4200),
 ('c0000000-0000-0000-0000-000000000002','Printing','Posters and certificates',3100),('c0000000-0000-0000-0000-000000000002','Banners','2 flex banners',1800);
-- link the demo donor login to a sample donor record so the donor portal shows history
update donors set user_id=(select id from auth.users where email='demo.donor@rotractclubsge.com') where id='d0000000-0000-0000-0000-000000000001'
  and not exists(select 1 from donors where user_id=(select id from auth.users where email='demo.donor@rotractclubsge.com'));
select (select count(*) from donors where source='sample')||' sample donors, '||(select count(*) from camps where id::text like 'c0000000-%')||' camps, '||
  (select count(*) from donations)||' donations, '||(select count(*) from blood_units where status='available')||' units available' as loaded;
