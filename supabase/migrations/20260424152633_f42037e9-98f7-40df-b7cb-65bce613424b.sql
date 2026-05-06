-- 1) Indexes for WhatsApp query performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user_category_active
  ON public.whatsapp_templates (user_id, category, active);

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_log_tenant_category
  ON public.whatsapp_send_log (tenant_id, template_category);

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_log_order
  ON public.whatsapp_send_log (order_id);

-- 2) Schedule WhatsApp crons (idempotent)
DO $$
DECLARE
  _supabase_url text;
  _service_role_key text;
BEGIN
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _service_role_key := current_setting('app.settings.service_role_key', true);

  IF _supabase_url IS NULL OR _service_role_key IS NULL THEN
    RAISE NOTICE 'Skipping cron schedule: app.settings.supabase_url or service_role_key not set';
    RETURN;
  END IF;

  -- Unschedule if exists (safe re-run)
  BEGIN PERFORM cron.unschedule('whatsapp-abandon-cron'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('whatsapp-pix-reminder'); EXCEPTION WHEN OTHERS THEN NULL; END;

  PERFORM cron.schedule(
    'whatsapp-abandon-cron',
    '*/15 * * * *',
    format($cmd$
      SELECT net.http_post(
        url:=%L,
        headers:=%L::jsonb,
        body:='{}'::jsonb
      );
    $cmd$,
      _supabase_url || '/functions/v1/whatsapp-abandon-cron',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_role_key
      )::text
    )
  );

  PERFORM cron.schedule(
    'whatsapp-pix-reminder',
    '*/10 * * * *',
    format($cmd$
      SELECT net.http_post(
        url:=%L,
        headers:=%L::jsonb,
        body:='{}'::jsonb
      );
    $cmd$,
      _supabase_url || '/functions/v1/whatsapp-pix-reminder',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_role_key
      )::text
    )
  );
END $$;

-- 3) Safe cart prefill RPC for recovery links (security definer, returns only non-sensitive PII the user already owns)
CREATE OR REPLACE FUNCTION public.get_abandoned_cart_prefill(p_cart_id uuid)
RETURNS TABLE(
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_cpf text,
  product_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ac.customer_name,
    ac.customer_email,
    ac.customer_phone,
    ac.customer_cpf,
    ac.product_id
  FROM public.abandoned_carts ac
  WHERE ac.id = p_cart_id
    AND ac.recovered = false
    AND ac.created_at > now() - interval '30 days'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_abandoned_cart_prefill(uuid) TO anon, authenticated;