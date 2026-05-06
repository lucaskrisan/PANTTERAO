-- Add login_url to appsell_integrations so the success page can redirect buyers
ALTER TABLE public.appsell_integrations
  ADD COLUMN IF NOT EXISTS login_url text DEFAULT NULL;

-- Public function: returns the producer's AppSell login URL for a given product
-- Used by CheckoutSuccess page (anon context) — login_url is not sensitive
CREATE OR REPLACE FUNCTION public.get_appsell_login_url(p_product_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ai.login_url
  FROM public.products p
  JOIN public.appsell_integrations ai ON ai.user_id = p.user_id
  WHERE p.id = p_product_id
    AND ai.active = true
    AND ai.login_url IS NOT NULL
    AND length(trim(ai.login_url)) > 0
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_appsell_login_url(uuid) TO anon, authenticated;
