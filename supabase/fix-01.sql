-- Fix 01: signed-in users (donors) could not open a camp registration link.
-- Run once in Supabase SQL Editor if you ran phase2.sql before 22 Oct 2026. Safe to run again.
drop policy if exists "public read open camps" on camps;
create policy "public read open camps" on camps for select to anon, authenticated using (status='open');
