-- Renewal reminders (SDD Section 4.13): every day at 8:00 AM Philippine time (00:00 UTC)
-- pg_cron calls the send-reminders Edge Function.
--
-- Before running this, in the Supabase dashboard:
--   1. Database > Extensions: enable pg_cron and pg_net.
--   2. Store the project URL and the service role key in Vault (never in this file):
--        select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--        select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

select cron.unschedule('neofit-send-reminders')
where exists (select 1 from cron.job where jobname = 'neofit-send-reminders');

select cron.schedule(
  'neofit-send-reminders',
  '0 0 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
