-- Add login_url column to appsell_integrations
ALTER TABLE public.appsell_integrations
  ADD COLUMN IF NOT EXISTS login_url TEXT;

-- RPC: get the AppSell login URL for a given product (used on the success page when no order_id)
CREATE OR REPLACE FUNCTION public.get_appsell_login_url(p_product_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ai.login_url
  FROM public.products p
  JOIN public.appsell_integrations ai ON ai.user_id = p.user_id
  WHERE p.id = p_product_id
    AND ai.active = true
  LIMIT 1;
$$;

-- RPC: return all delivery links for an order (main product + bumps)
CREATE OR REPLACE FUNCTION public.get_order_delivery_links(p_order_id uuid)
RETURNS TABLE(delivery_type text, access_url text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product_ids uuid[];
BEGIN
  -- Collect main product + any bump product ids from order metadata
  SELECT ARRAY(
    SELECT DISTINCT pid FROM (
      SELECT o.product_id AS pid FROM public.orders o WHERE o.id = p_order_id
      UNION
      SELECT (jsonb_array_elements_text(COALESCE(o.metadata->'bump_product_ids', '[]'::jsonb)))::uuid AS pid
      FROM public.orders o WHERE o.id = p_order_id
        AND jsonb_typeof(o.metadata->'bump_product_ids') = 'array'
    ) s
    WHERE pid IS NOT NULL
  ) INTO _product_ids;

  RETURN QUERY
  SELECT
    COALESCE(p.delivery_method, 'panttera')::text AS delivery_type,
    CASE
      WHEN p.delivery_method = 'appsell' THEN ai.login_url
      ELSE NULL
    END AS access_url
  FROM unnest(_product_ids) WITH ORDINALITY AS u(pid, ord)
  JOIN public.products p ON p.id = u.pid
  LEFT JOIN public.appsell_integrations ai
    ON ai.user_id = p.user_id AND ai.active = true
  ORDER BY u.ord;
END;
$$;