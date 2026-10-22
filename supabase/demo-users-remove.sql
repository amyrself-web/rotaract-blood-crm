-- Deletes the demo logins made by demo-users.sql (their profiles go with them).
delete from auth.users where email in ('demo.coordinator@rotractclubsge.com','demo.medical@rotractclubsge.com',
  'demo.volunteer@rotractclubsge.com','demo.donor@rotractclubsge.com');
