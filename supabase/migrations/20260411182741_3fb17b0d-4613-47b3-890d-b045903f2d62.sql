SELECT cron.schedule(
  'abandoned-cart-email-recovery',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vipltojtcrqatwvzobro.supabase.co/functions/v1/abandoned-cart-email-recovery-cron',
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