-- Revoke client-side access to card_token on billing_accounts
REVOKE SELECT (card_token) ON public.billing_accounts FROM authenticated;
REVOKE SELECT (card_token) ON public.billing_accounts FROM anon;

-- Revoke client-side access to secret on webhook_endpoints
REVOKE SELECT (secret) ON public.webhook_endpoints FROM authenticated;
REVOKE SELECT (secret) ON public.webhook_endpoints FROM anon;

-- Create a security definer function so edge functions can still read webhook secrets
CREATE OR REPLACE FUNCTION public.get_webhook_secret(p_webhook_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT secret FROM public.webhook_endpoints WHERE id = p_webhook_id;
$$;