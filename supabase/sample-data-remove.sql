-- Removes everything sample-data.sql added (sample camps, donors, stock, requests and the 4 demo logins).
-- Records you have already edited into real ones are removed too if they still use the sample ids, so check first.
delete from blood_units where source='sample' or donation_reg in (select r.id from registrations r where r.camp_id::text like 'c0000000-%');
delete from camps where id::text like 'c0000000-0000-0000-0000-00000000000%';
delete from donors where id::text like 'd0000000-0000-0000-0000-%';
delete from emergency_requests where patient_ref='SAMPLE';
delete from auth.users where email in ('demo.coordinator@rotractclubsge.com','demo.medical@rotractclubsge.com','demo.volunteer@rotractclubsge.com','demo.donor@rotractclubsge.com');
