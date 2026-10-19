-- Torn Command Center - cron schedule for evaluate-alerts

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('evaluate-alerts') where exists (select 1 from cron.job where jobname = 'evaluate-alerts');

select cron.schedule(
  'evaluate-alerts',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/evaluate-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
