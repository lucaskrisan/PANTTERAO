-- Returns distinct delivery types + access URLs needed after an order.
-- Covers main product + bump products stored in orders.metadata.bump_product_ids.
CREATE OR REPLACE FUNCTION public.get_order_delivery_links(p_order_id uuid)
RETURNS TABLE(
  delivery_type text,
  access_url    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH order_data AS (
    SELECT
      o.product_id AS main_product_id,
      o.user_id    AS owner_id,
      COALESCE(
        ARRAY(
          SELECT elem::uuid
          FROM jsonb_array_elements_text(
            COALESCE((o.metadata->>'bump_product_ids')::jsonb, '[]'::jsonb)
          ) AS elem
          WHERE elem ~ '^[0-9a-f\-]{36}$'
        ),
        '{}'::uuid[]
      ) AS bump_ids
    FROM public.orders o
    WHERE o.id = p_order_id
    LIMIT 1
  ),
  all_product_ids AS (
    SELECT UNNEST(ARRAY[main_product_id] || bump_ids) AS pid
    FROM order_data
  ),
  product_deliveries AS (
    SELECT DISTINCT
      COALESCE(p.delivery_method, 'appsell') AS dm,
      p.user_id
    FROM all_product_ids api
    JOIN public.products p ON p.id = api.pid
  )
  SELECT DISTINCT ON (pd.dm)
    pd.dm                                    AS delivery_type,
    CASE WHEN pd.dm = 'appsell'
      THEN (
        SELECT ai.login_url
        FROM public.appsell_integrations ai
        WHERE ai.user_id = pd.user_id
          AND ai.active = true
          AND length(trim(COALESCE(ai.login_url, ''))) > 0
        LIMIT 1
      )
      ELSE NULL
    END                                      AS access_url
  FROM product_deliveries pd;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_delivery_links(uuid) TO anon, authenticated;
