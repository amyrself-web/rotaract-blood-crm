-- Run once in Supabase: SQL Editor > New query > paste > Run
create type app_role as enum ('admin','coordinator','medical','volunteer','donor');
create table profiles(
  id uuid primary key references auth.users on delete cascade,
  full_name text, phone text,
  role app_role not null default 'donor',
  active boolean not null default true,
  created_at timestamptz default now());
alter table profiles enable row level security;
create function has_role(r app_role[]) returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from profiles where id=auth.uid() and active and role=any(r)) $$;
create policy "read own profile" on profiles for select using (id=auth.uid());
create policy "staff read all" on profiles for select using (has_role(array['admin','coordinator']::app_role[]));
create policy "admin update" on profiles for update using (has_role(array['admin']::app_role[]));
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as
$$ begin insert into profiles(id,full_name) values(new.id,new.raw_user_meta_data->>'full_name'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
-- After you sign up, make yourself the first admin (replace the email):
-- update profiles set role='admin' where id=(select id from auth.users where email='you@example.com');
