
-- 1. Fix active_gateways: it's a view, views don't have RLS themselves.
-- The security_invoker flag means it uses the caller's permissions on payment_gateways.
-- payment_gateways already has RLS restricting to owner/super_admin.
-- The scanner flags it because views show "no RLS policies". We need to ensure
-- the view is truly restricted. Let's check if RLS is enabled on payment_gateways
-- (it should be). The real fix: ensure anon has no SELECT grant on payment_gateways.
REVOKE SELECT ON public.payment_gateways FROM anon;

-- 2. Enable RLS on webhook_events and restrict to service_role only
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages webhook events" ON public.webhook_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
