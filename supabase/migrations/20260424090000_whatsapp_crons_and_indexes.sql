-- WhatsApp automation crons + performance indexes

-- 1. Cron: WhatsApp abandoned cart recovery — every 15 minutes
SELECT cron.schedule(
  'whatsapp-abandon-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vipltojtcrqatwvzobro.supabase.co/functions/v1/whatsapp-abandon-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 2. Cron: WhatsApp PIX payment reminder — every 10 minutes
SELECT cron.schedule(
  'whatsapp-pix-reminder',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vipltojtcrqatwvzobro.supabase.co/functions/v1/whatsapp-pix-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3. Index: whatsapp_templates query by (user_id, category, active) — used in whatsapp-dispatch
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user_category_active
  ON public.whatsapp_templates (user_id, category, active);

-- 4. Index: whatsapp_send_log query by (tenant_id, template_category) — used in crons
CREATE INDEX IF NOT EXISTS idx_whatsapp_send_log_tenant_category
  ON public.whatsapp_send_log (tenant_id, template_category);

-- 5. Index: whatsapp_send_log query by (order_id) — used in abandonment tracking
CREATE INDEX IF NOT EXISTS idx_whatsapp_send_log_order_id
  ON public.whatsapp_send_log (order_id);
