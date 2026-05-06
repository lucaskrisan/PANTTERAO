DROP FUNCTION IF EXISTS public.get_dashboard_metrics(uuid, timestamp with time zone, timestamp with time zone, uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
    p_user_id uuid,
    p_date_from timestamp with time zone,
    p_date_to timestamp with time zone,
    p_product_id uuid DEFAULT NULL,
    p_is_super_admin boolean DEFAULT false,
    p_currency text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  result jsonb;
  _timezone text := 'America/Sao_Paulo';
BEGIN
  -- Build dynamic metrics via CTEs
  WITH filtered_orders AS (
    SELECT id, created_at, status, amount, platform_fee_amount, payment_method, product_id, metadata, customer_state
    FROM public.orders
    WHERE (p_is_super_admin OR user_id = p_user_id)
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to IS NULL OR created_at < p_date_to)
      AND (p_product_id IS NULL OR product_id = p_product_id)
      AND (p_currency IS NULL OR (SELECT currency FROM products WHERE id = product_id) = p_currency)
  ),
  approved AS (
    SELECT * FROM filtered_orders WHERE status IN ('paid', 'approved', 'confirmed')
  ),
  pending AS (
    SELECT * FROM filtered_orders WHERE status = 'pending'
  ),
  refunded AS (
    SELECT * FROM filtered_orders WHERE status = 'refunded'
  ),
  chargebacked AS (
    SELECT * FROM filtered_orders WHERE status = 'chargedback'
  ),
  -- Card approval
  card_decided AS (
    SELECT status FROM filtered_orders WHERE payment_method = 'credit_card' AND status != 'pending'
  ),
  card_approved AS (
    SELECT 1 FROM card_decided WHERE status IN ('paid', 'approved')
  ),
  -- Pix approval
  pix_decided AS (
    SELECT status FROM filtered_orders WHERE payment_method = 'pix' AND status != 'pending'
  ),
  pix_approved AS (
    SELECT 1 FROM pix_decided WHERE status IN ('paid', 'approved')
  ),
  -- UTM split
  paid_sales AS (
    SELECT amount FROM approved WHERE metadata->>'utm_source' IS NOT NULL AND metadata->>'utm_source' != ''
  ),
  organic_sales AS (
    SELECT amount FROM approved WHERE metadata->>'utm_source' IS NULL OR metadata->>'utm_source' = ''
  ),
  -- State distribution
  state_data AS (
    SELECT upper(trim(customer_state)) AS st, count(*) AS cnt, sum(amount) AS rev
    FROM approved
    WHERE customer_state IS NOT NULL AND length(trim(customer_state)) = 2
    GROUP BY upper(trim(customer_state))
  ),
  -- Abandoned carts
  carts AS (
    SELECT id, created_at, recovered
    FROM public.abandoned_carts
    WHERE (p_is_super_admin OR user_id = p_user_id)
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to IS NULL OR created_at < p_date_to)
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
        SELECT extract(hour from created_at AT TIME ZONE _timezone)::int AS hr, sum(amount) AS t
        FROM approved GROUP BY hr
      ) agg ON agg.hr = h
    ),
    'chart_daily', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d::date, 'total', COALESCE(t, 0)) ORDER BY d), '[]'::jsonb)
      FROM generate_series(
        COALESCE(p_date_from AT TIME ZONE _timezone, (now() AT TIME ZONE _timezone - interval '30 days'))::date,
        COALESCE(p_date_to AT TIME ZONE _timezone, (now() AT TIME ZONE _timezone))::date,
        '1 day'::interval
      ) AS d
      LEFT JOIN (
        SELECT (created_at AT TIME ZONE _timezone)::date AS dt, sum(amount) AS t
        FROM approved GROUP BY dt
      ) agg ON agg.dt = d::date
    ),
    'by_currency', (
      SELECT jsonb_object_agg(currency, currency_metrics)
      FROM (
        SELECT 
          p.currency,
          jsonb_build_object(
            'approved_count', count(a.*),
            'approved_amount', COALESCE(sum(a.amount), 0),
            'fees_amount', COALESCE(sum(COALESCE(a.platform_fee_amount, 0)), 0),
            'net_amount', COALESCE(sum(a.amount - COALESCE(a.platform_fee_amount, 0)), 0),
            'pending_count', (SELECT count(*) FROM pending o2 JOIN products p2 ON p2.id = o2.product_id WHERE p2.currency = p.currency),
            'pending_amount', (SELECT COALESCE(sum(amount), 0) FROM pending o2 JOIN products p2 ON p2.id = o2.product_id WHERE p2.currency = p.currency)
          ) as currency_metrics
        FROM approved a
        JOIN products p ON p.id = a.product_id
        GROUP BY p.currency
      ) s
    )
  ) INTO result;

  RETURN result;
END;
$function$;
