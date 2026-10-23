-- v9b: only when using the official WhatsApp Cloud API. Every minute, if messages are waiting, wake the wa-cloud Edge Function.
-- Replace PROJECT_REF and ANON_KEY if you copy this to another project. Run after v9.
create extension if not exists pg_net;
select cron.schedule('wa-cloud-send','* * * * *', $job$
  select net.http_post(url:='https://bgwkantvhgbxzfkipfda.supabase.co/functions/v1/wa-cloud?run=1',
    headers:=jsonb_build_object('Content-Type','application/json'), body:='{}'::jsonb, timeout_milliseconds:=55000)
  where exists(select 1 from public.wa_settings where id=1 and provider='cloud')
    and exists(select 1 from public.wa_outbox where status='queued' and send_after<=now());
$job$);
