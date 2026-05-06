-- Daily EMQ snapshot cron — runs at 08:00 UTC every day
-- Feeds the emq_snapshots table used by the HeroKPIStrip EMQ card
SELECT cron.schedule(
  'emq-daily-snapshot',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vipltojtcrqatwvzobro.supabase.co/functions/v1/meta-emq-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
