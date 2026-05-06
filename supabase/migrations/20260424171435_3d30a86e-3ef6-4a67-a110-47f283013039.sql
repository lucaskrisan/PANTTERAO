CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_user_id uuid,
  p_date_from timestamp with time zone DEFAULT NULL,
  p_date_to timestamp with time zone DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_is_super_admin boolean DEFAULT false,
  p_currency text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH filtered_orders AS (
    SELECT o.id, o.created_at, o.status, o.amount, o.platform_fee_amount,
           o.payment_method, o.product_id, o.metadata, o.customer_state,
           COALESCE(p.currency, 'BRL') AS currency
    FROM public.orders o
    LEFT JOIN public.products p ON p.id = o.product_id
    WHERE (p_is_super_admin OR o.user_id = p_user_id)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to)
      AND (p_product_id IS NULL OR o.product_id = p_product_id)
      AND (p_currency IS NULL OR COALESCE(p.currency, 'BRL') = p_currency)
  ),
  approved AS (SELECT * FROM filtered_orders WHERE status IN ('paid', 'approved', 'confirmed')),
  pending AS (SELECT * FROM filtered_orders WHERE status = 'pending'),
  refunded AS (SELECT * FROM filtered_orders WHERE status = 'refunded'),
  chargebacked AS (SELECT * FROM filtered_orders WHERE status = 'chargedback'),
  card_decided AS (SELECT status FROM filtered_orders WHERE payment_method = 'credit_card' AND status != 'pending'),
  card_approved AS (SELECT 1 FROM card_decided WHERE status IN ('paid', 'approved')),
  pix_decided AS (SELECT status FROM filtered_orders WHERE payment_method = 'pix' AND status != 'pending'),
  pix_approved AS (SELECT 1 FROM pix_decided WHERE status IN ('paid', 'approved')),
  paid_sales AS (SELECT amount FROM approved WHERE metadata->>'utm_source' IS NOT NULL AND metadata->>'utm_source' != ''),
  organic_sales AS (SELECT amount FROM approved WHERE metadata->>'utm_source' IS NULL OR metadata->>'utm_source' = ''),
  state_data AS (
    SELECT upper(trim(customer_state)) AS st, count(*) AS cnt, sum(amount) AS rev
    FROM approved
    WHERE customer_state IS NOT NULL AND length(trim(customer_state)) = 2
    GROUP BY upper(trim(customer_state))
  ),
  carts AS (
    SELECT id, created_at, recovered
    FROM public.abandoned_carts
    WHERE (p_is_super_admin OR user_id = p_user_id)
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to IS NULL OR created_at < p_date_to)
  ),
  by_currency AS (
    SELECT
      COALESCE(p.currency, 'BRL') AS currency,
      COUNT(*) FILTER (WHERE o.status IN ('paid','approved','confirmed')) AS approved_count,
      COALESCE(SUM(o.amount) FILTER (WHERE o.status IN ('paid','approved','confirmed')), 0) AS approved_amount,
      COUNT(*) FILTER (WHERE o.status = 'pending') AS pending_count,
      COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'pending'), 0) AS pending_amount
    FROM public.orders o
    LEFT JOIN public.products p ON p.id = o.product_id
    WHERE (p_is_super_admin OR o.user_id = p_user_id)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to)
      AND (p_product_id IS NULL OR o.product_id = p_product_id)
    GROUP BY COALESCE(p.currency, 'BRL')
  )
  SELECT jsonb_build_object(
    'total_bruto', (SELECT COALESCE(sum(amount), 0) FROM approved),
    'total_taxas', (SELECT COALESCE(sum(COALESCE(platform_fee_amount, 0)), 0) FROM approved),
    'total_pendente', (SELECT COALESCE(sum(amount), 0) FROM pending),
    'total_refunded', (SELECT COALESCE(sum(amount), 0) FROM refunded),
    'total_chargeback', (SELECT COALESCE(sum(amount), 0) FROM chargebacked),
    'count_approved', (SELECT count(*) FROM approved),
    'count_pending', (SELECT count(*) FROM pending),
    'count_refunded', (SELECT count(*) FROM refunded),
    'count_chargedback', (SELECT count(*) FROM chargebacked),
    'count_total', (SELECT count(*) FROM filtered_orders),
    'card_decided', (SELECT count(*) FROM card_decided),
    'card_approved', (SELECT count(*) FROM card_approved),
    'pix_decided', (SELECT count(*) FROM pix_decided),
    'pix_approved', (SELECT count(*) FROM pix_approved),
    'paid_sales_count', (SELECT count(*) FROM paid_sales),
    'paid_revenue', (SELECT COALESCE(sum(amount), 0) FROM paid_sales),
    'organic_sales_count', (SELECT count(*) FROM organic_sales),
    'organic_revenue', (SELECT COALESCE(sum(amount), 0) FROM organic_sales),
    'abandoned_total', (SELECT count(*) FROM carts),
    'abandoned_recovered', (SELECT count(*) FROM carts WHERE recovered = true),
    'sales_by_state', COALESCE((SELECT jsonb_object_agg(st, jsonb_build_object('count', cnt, 'revenue', rev)) FROM state_data), '{}'::jsonb),
    'chart_hourly', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h, 'total', COALESCE(t, 0)) ORDER BY h), '[]'::jsonb)
      FROM generate_series(0, 23) AS h
      LEFT JOIN (
        SELECT extract(hour from created_at)::int AS hr, sum(amount) AS t
        FROM approved GROUP BY hr
      ) agg ON agg.hr = h
    ),
    'chart_daily', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d::date, 'total', COALESCE(t, 0)) ORDER BY d), '[]'::jsonb)
      FROM generate_series(
        COALESCE(p_date_from, now() - interval '30 days')::date,
        COALESCE(p_date_to, now())::date,
        '1 day'::interval
      ) AS d
      LEFT JOIN (
        SELECT created_at::date AS dt, sum(amount) AS t
        FROM approved GROUP BY dt
      ) agg ON agg.dt = d::date
    ),
    'by_currency', COALESCE((
      SELECT jsonb_object_agg(
        currency,
        jsonb_build_object(
          'approved_count', approved_count,
          'approved_amount', approved_amount,
          'pending_count', pending_count,
          'pending_amount', pending_amount
        )
      ) FROM by_currency
    ), '{}'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;