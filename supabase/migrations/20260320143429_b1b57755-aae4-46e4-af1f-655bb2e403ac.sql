
-- Webhook delivery logs table
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_id text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_retry_at timestamptz,
  last_response_status integer,
  last_response_body text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for retry queue processing
CREATE INDEX idx_webhook_deliveries_retry ON public.webhook_deliveries (status, next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_endpoint ON public.webhook_deliveries (endpoint_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_user ON public.webhook_deliveries (user_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_event_id ON public.webhook_deliveries (event_id);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own deliveries"
  ON public.webhook_deliveries FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Service role manages deliveries"
  ON public.webhook_deliveries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Add more event types to webhook_endpoints (update events column default)
-- Also add product_id filter support
ALTER TABLE public.webhook_endpoints ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.webhook_endpoints ADD COLUMN IF NOT EXISTS description text;
