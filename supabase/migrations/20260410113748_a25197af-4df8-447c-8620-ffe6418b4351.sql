-- Revoke SELECT on the config column from authenticated and anon roles
-- This prevents API secrets from being transmitted to the browser
-- INSERT/UPDATE still work so users can save their gateway credentials
REVOKE SELECT (config) ON public.payment_gateways FROM authenticated;
REVOKE SELECT (config) ON public.payment_gateways FROM anon;