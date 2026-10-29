-- v28: the master admin can never be removed, demoted or switched off. Run once, after v27.
-- The master admin is the first admin account (kept in private.config 'master_admin_id').
-- Protects against: test-data removal, the Users page, the admin-users function and plain SQL deletes.
insert into private.config(k,v)
  select 'master_admin_id',id::text from profiles where role='admin' and active order by created_at nulls last, id limit 1
  on conflict(k) do nothing;

-- if none is recorded yet (a brand-new database), the first active admin is the master
create or replace function private.master_admin() returns uuid language sql stable security definer set search_path=public as $$
  select coalesce((select v::uuid from private.config where k='master_admin_id'),
                  (select id from profiles where role='admin' and active order by created_at nulls last, id limit 1)) $$;

create or replace function private.protect_master_login() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.id=private.master_admin() then raise exception 'The master admin login cannot be removed'; end if;
  return old; end $$;
drop trigger if exists protect_master_login on auth.users;
create trigger protect_master_login before delete on auth.users for each row execute function private.protect_master_login();

create or replace function private.protect_master_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.id=private.master_admin() then
    if tg_op='DELETE' then raise exception 'The master admin cannot be removed'; end if;
    if new.role<>'admin' or not new.active then raise exception 'The master admin always stays an active admin'; end if;
  end if;
  return coalesce(new,old); end $$;
drop trigger if exists protect_master_profile on profiles;
create trigger protect_master_profile before update or delete on profiles for each row execute function private.protect_master_profile();

-- the Settings screen shows who the master admin is
create or replace function master_admin_info() returns jsonb language sql stable security definer set search_path=public as $$
  select case when exists(select 1 from profiles where id=auth.uid() and role='admin') then
    (select jsonb_build_object('id',u.id,'email',u.email,'name',p.full_name) from auth.users u left join profiles p on p.id=u.id where u.id=private.master_admin()) end $$;
revoke execute on function master_admin_info() from public, anon; grant execute on function master_admin_info() to authenticated;
revoke execute on function private.master_admin() from public, anon;
