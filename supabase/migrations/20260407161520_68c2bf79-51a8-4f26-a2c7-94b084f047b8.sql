-- Revoke client-side access to config (contains API keys) on payment_gateways
REVOKE SELECT (config) ON public.payment_gateways FROM authenticated;
REVOKE SELECT (config) ON public.payment_gateways FROM anon;