
CREATE TABLE public.webhook_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  caller_user_id uuid,
  caller_type text NOT NULL DEFAULT 'unknown',
  event_type text NOT NULL,
  order_id uuid,
  order_status_at_fire text,
  environment text NOT NULL DEFAULT 'production',
  blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  payload jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  deliveries_count integer DEFAULT 0
);

ALTER TABLE public.webhook_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read audit log"
  ON public.webhook_audit_log FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Service role manages audit log"
  ON public.webhook_audit_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_webhook_audit_order ON public.webhook_audit_log(order_id);
CREATE INDEX idx_webhook_audit_created ON public.webhook_audit_log(created_at DESC);
