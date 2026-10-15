-- Phase 4: WhatsApp message queues. Run once in Supabase SQL Editor (after phase3.sql)
create table message_templates(
  kind text primary key, body text not null, updated_at timestamptz default now());
create table message_log(
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references donors on delete cascade,
  kind text not null, ref text not null,
  sent_by uuid references auth.users, created_at timestamptz default now(),
  unique(donor_id,kind,ref));
alter table message_templates enable row level security;
alter table message_log enable row level security;
create policy "staff read templates" on message_templates for select using (has_role(array['admin','coordinator']::app_role[]));
create policy "admin write templates" on message_templates for all using (has_role(array['admin']::app_role[])) with check (has_role(array['admin']::app_role[]));
create policy "staff manage message log" on message_log for all using (has_role(array['admin','coordinator']::app_role[])) with check (has_role(array['admin','coordinator']::app_role[]));
