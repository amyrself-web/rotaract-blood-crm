-- v17: public pages update by themselves. Run once, after v16.
-- Any change to camps, events, projects, registrations, donations, settings and the rest ticks one public row.
-- The front page, sign-in page, camp registration, event registration and impact page listen to that row
-- and reload their (already public) numbers at once. The row carries only a time, never any data.
create table if not exists site_pulse(topic text primary key, at timestamptz not null default now());
alter table site_pulse enable row level security;
drop policy if exists "pulse read" on site_pulse;
create policy "pulse read" on site_pulse for select using (true);
grant select on site_pulse to anon, authenticated;
insert into site_pulse(topic) values('public') on conflict do nothing;

create or replace function bump_pulse() returns trigger language plpgsql security definer set search_path=public as $$
declare tx text := txid_current()::text; begin
  -- once per transaction is enough, however many rows changed
  if coalesce(current_setting('app.pulse_tx',true),'')=tx then return null; end if;
  perform set_config('app.pulse_tx',tx,true);
  update site_pulse set at=clock_timestamp() where topic='public';
  return null; end $$;
revoke execute on function bump_pulse() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['camps','registrations','donations','events','event_people','projects','project_hours','settings',
                           'donors','donor_events','members','afterlife_cases','pledges','notices'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists pulse_%1$s on %1$I', t);
      execute format('create trigger pulse_%1$s after insert or update or delete on %1$I for each statement execute function bump_pulse()', t);
    end if;
  end loop;
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='site_pulse') then
    alter publication supabase_realtime add table site_pulse; end if;
end $$;
