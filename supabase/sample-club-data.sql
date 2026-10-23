-- Sample club data: 12 members, dues, 10 meetings with attendance and minutes, action items, 4 pledges, 2 eye/body donation cases.
-- Every sample row has notes = 'sample' (members, pledges, cases) or title starting with "[Sample]" is NOT used, so remove with:
--   delete from afterlife_cases where notes='sample'; delete from pledges where notes='sample';
--   delete from meetings where agenda like 'Sample:%'; delete from members where notes='sample';
do $$ begin if exists(select 1 from members where notes='sample') then raise exception 'Sample club data is already loaded'; end if; end $$;

insert into members(full_name,phone,email,dob,gender,blood_group,area,occupation,organisation,position,membership_type,joined_on,notes) values
 ('Arun Prakash','9790010001','arun.p@example.com','2001-03-14','Male','O+','Sankari','Working professional','TCS','President','Active','2024-07-01','sample'),
 ('Divya Shree','9790010002','divya.s@example.com','2002-08-21','Female','B+','Salem','Student','Sona College','Secretary','Active','2024-07-01','sample'),
 ('Karthik Raja','9790010003',null,'2000-11-02','Male','A+','Edappadi','Business',null,'Treasurer','Active','2024-07-01','sample'),
 ('Nandhini K','9790010004',null,'2003-01-30','Female','AB+','Sankari','Student','KSR College','Vice President','Active','2024-08-15','sample'),
 ('Vignesh M','9790010005',null,'2002-05-09','Male','O-','Omalur','Student','KSR College','Blood Donation Chair','Active','2025-01-10','sample'),
 ('Pooja R','9790010006',null,'2004-02-17','Female','A-','Salem','Student','Sona College','Public Relations Director','Active','2025-07-01','sample'),
 ('Saravanan T','9790010007',null,'1999-09-25','Male','B-','Tiruchengode','Working professional','Infosys','Club Service Director','Active','2025-07-01','sample'),
 ('Harini V','9790010008',null,'2004-06-11','Female','O+','Sankari','Student','KSR College','Member','Active','2025-09-01','sample'),
 ('Gokul S','9790010009',null,'2003-12-05','Male','A+','Mettur','Student','Sona College','Member','Active','2026-07-20','sample'),
 ('Meena Kumari','9790010010',null,'2002-04-18','Female','B+','Salem','Working professional','Zoho','Member','Prospective','2026-09-01','sample'),
 ('Ramesh Babu','9790010011',null,'1996-10-01','Male','O+','Sankari','Business',null,'Member','Alumni','2021-07-01','sample'),
 ('Sowmya P','9790010012',null,'2003-07-07','Female','AB-','Edappadi','Student','KSR College','Member','Active','2025-07-01','sample');
update members set status='inactive' where full_name='Ramesh Babu' and notes='sample';

insert into member_dues(member_id,period,amount,paid_on,mode,reference)
select id,'2026-27',600,date '2026-07-05'+(member_no%20),case when member_no%3=0 then 'Cash' else 'UPI' end,case when member_no%3=0 then null else 'UPI'||(4410000+member_no) end
from members where notes='sample' and status='active' and full_name not in ('Gokul S','Harini V','Meena Kumari');

-- weekly meetings every Wednesday from mid July, plus monthly GBMs
insert into meetings(kind,title,meeting_date,start_time,end_time,venue,chaired_by,minutes_by,agenda,minutes,decisions,status,guests)
select 'Weekly','Weekly meeting '||g, d, '19:00','20:00','Rotary Hall, Sankari','Arun Prakash','Divya Shree',
  'Sample: 1. Welcome  2. Last week''s minutes  3. Blood camp preparation  4. Any other business',
  'Members discussed preparations for the Sankari Mega Blood Donation Camp. Volunteer desks and duty rota were reviewed. Treasurer shared the expense status.',
  'Volunteer list to be finalised by the Blood Donation Chair.', 'held', (g%3)
from (select row_number() over () g, d::date d from generate_series(date '2026-07-15', current_date-1, interval '14 days') d) x;
insert into meetings(kind,title,meeting_date,start_time,end_time,venue,chaired_by,minutes_by,chief_guest,agenda,minutes,decisions,status,guests) values
 ('Monthly','Monthly general body meeting - August','2026-08-30','17:00','18:30','Hotel Saravana, Sankari','Arun Prakash','Divya Shree','Rtn. S. Kumar, President, Rotary Club of Sankari',
  'Sample: 1. Club report  2. Treasurer report  3. Eye donation awareness drive  4. Induction of new members',
  'The President presented the quarterly report. The club agreed to run an eye donation pledge drive in October with Aravind Eye Bank.',
  'Eye donation pledge drive approved. Budget Rs. 5,000.','held',6),
 ('Monthly','Monthly general body meeting - September','2026-09-27','17:00','18:30','Hotel Saravana, Sankari','Arun Prakash','Divya Shree',null,
  'Sample: 1. Blood camp plan  2. Sponsorship status  3. Dues collection','Sponsorship of Rs. 25,000 confirmed. Three members yet to pay dues.','Camp date fixed for 30 October.','held',2),
 ('Weekly','Weekly meeting',current_date+5,'19:00','20:00','Rotary Hall, Sankari',null,null,null,'Sample: Camp final checklist',null,null,'scheduled',0);

insert into meeting_attendance(meeting_id,member_id,status)
select m.id,b.id,case when (b.member_no*7+m.meeting_no*3)%11=0 then 'absent' when (b.member_no+m.meeting_no)%9=0 then 'leave' when (b.member_no+m.meeting_no)%7=0 then 'late' else 'present' end
from meetings m join members b on b.notes='sample' and b.status='active' and b.joined_on<=m.meeting_date
where m.status='held' and m.agenda like 'Sample:%' and (b.member_no*5+m.meeting_no)%13<>0;

insert into meeting_actions(meeting_id,task,owner_member,due,done)
select m.id,t.task,(select id from members where full_name=t.owner and notes='sample'),t.due,t.done
from (values ('Book Aravind Eye Bank team for pledge drive','Nandhini K',date '2026-09-15',true),('Print 200 eye donation pledge forms','Pooja R',date '2026-10-05',true),
             ('Collect pending dues from 3 members','Karthik Raja',current_date-2,false),('Confirm refreshment sponsor for camp','Saravanan T',current_date+4,false)) t(task,owner,due,done),
     lateral (select id from meetings where kind='Monthly' and agenda like 'Sample:%' order by meeting_date desc limit 1) m;

insert into pledges(full_name,phone,dob,gender,blood_group,area,eye,body,organ,skin,pledged_on,witness_name,family_contact,family_phone,family_informed,card_issued,institution,notes) values
 ('Muthusamy K','9790020001','1952-04-10','Male','B+','Sankari',true,false,false,false,'2026-10-02','Arun Prakash','Senthil (son)','9790020101',true,true,'Aravind Eye Bank, Coimbatore','sample'),
 ('Lakshmi Ammal','9790020002','1958-09-01','Female','O+','Edappadi',true,true,false,false,'2026-10-02','Divya Shree','Ravi (son)','9790020102',true,true,'Aravind Eye Bank, Coimbatore','sample'),
 ('Prabhu Shankar','9790020003','1985-01-22','Male','A+','Salem',true,false,true,true,'2026-10-09',null,'Kavitha (wife)','9790020103',false,false,null,'sample'),
 ('Selvi R','9790020004','1970-12-12','Female',null,'Sankari',true,false,false,false,'2026-08-30','Nandhini K','Gopal (husband)','9790020104',true,false,'Aravind Eye Bank, Coimbatore','sample');

insert into afterlife_cases(kinds,deceased_name,age,gender,area,died_on,died_at,place_of_death,cause_of_death,informed_at,collected_at,institution,institution_contact,team_lead,corneas,
  family_contact,family_relation,family_phone,consent_by,consent_form,coordinated_by,status,letter_issued,notes) values
 (array['eye'],'Rangasamy P',78,'Male','Sankari',current_date-12,'05:40','Home','Old age',
   ((current_date-12)+time '06:10') at time zone 'Asia/Kolkata',((current_date-12)+time '08:25') at time zone 'Asia/Kolkata','Aravind Eye Bank, Coimbatore','0422 0000000','Dr. Meera',2,
   'Kumar','Son','9790030001','Kumar, Saranya',true,'Vignesh M','handed over',false,'sample'),
 (array['eye','body'],'Kamala Devi',81,'Female','Edappadi',current_date-40,'22:15','Hospital','Heart failure',
   ((current_date-40)+time '22:40') at time zone 'Asia/Kolkata',((current_date-39)+time '01:05') at time zone 'Asia/Kolkata','Govt Mohan Kumaramangalam Medical College, Salem',null,'Dr. Anand',2,
   'Rajesh','Son','9790030002','Rajesh, Malathi',true,'Arun Prakash','handed over',true,'sample');

select (select count(*) from members where notes='sample')||' members, '||(select count(*) from meetings where agenda like 'Sample:%')||' meetings, '||
  (select count(*) from pledges where notes='sample')||' pledges, '||(select count(*) from afterlife_cases where notes='sample')||' cases' as loaded;
