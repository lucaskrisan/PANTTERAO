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
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH filtered_orders AS (
    SELECT o.id, o.created_at, o.status, o.amount, o.platform_fee_amount, o.payment_method, o.product_id, o.metadata, o.customer_state
    FROM public.orders o
    LEFT JOIN public.products p ON o.product_id = p.id
    WHERE (p_is_super_admin OR o.user_id = p_user_id)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to)
      AND (p_product_id IS NULL OR o.product_id = p_product_id)
      AND (p_currency IS NULL OR p.currency = p_currency)
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
    -- Include both singular and plural for compatibility
    SELECT * FROM filtered_orders WHERE status IN ('chargeback', 'chargedback')
  ),
  card_decided AS (
    SELECT status FROM filtered_orders WHERE payment_method IN ('credit_card', 'credit_card_pix') AND status != 'pending'
  ),
  card_approved AS (
    SELECT 1 FROM card_decided WHERE status IN ('paid', 'approved', 'confirmed')
  ),
  pix_decided AS (
    SELECT status FROM filtered_orders WHERE (payment_method = 'pix' OR payment_method = 'credit_card_pix') AND status != 'pending'
  ),
  pix_approved AS (
    SELECT 1 FROM pix_decided WHERE status IN ('paid', 'approved', 'confirmed')
  ),
  paid_sales AS (
    -- Using utm_source presence to identify paid traffic vs organic
    SELECT amount FROM approved WHERE metadata->>'utm_source' IS NOT NULL AND metadata->>'utm_source' != ''
  ),
  organic_sales AS (
    SELECT amount FROM approved WHERE metadata->>'utm_source' IS NULL OR metadata->>'utm_source' = ''
  ),
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
  -- Breakdown by currency if p_currency is NULL
  currency_breakdown AS (
    SELECT 
        p.currency,
        COUNT(*) FILTER (WHERE o.status IN ('paid', 'approved', 'confirmed')) as approved_count,
        SUM(o.amount) FILTER (WHERE o.status IN ('paid', 'approved', 'confirmed')) as approved_amount,
        SUM(COALESCE(o.platform_fee_amount, 0)) FILTER (WHERE o.status IN ('paid', 'approved', 'confirmed')) as fees_amount,
        COUNT(*) FILTER (WHERE o.status = 'pending') as pending_count,
        SUM(o.amount) FILTER (WHERE o.status = 'pending') as pending_amount,
        COUNT(*) FILTER (WHERE o.status = 'refunded') as refunded_count,
        SUM(o.amount) FILTER (WHERE o.status = 'refunded') as refunded_amount,
        COUNT(*) FILTER (WHERE o.status IN ('chargeback', 'chargedback')) as chargeback_count,
        SUM(o.amount) FILTER (WHERE o.status IN ('chargeback', 'chargedback')) as chargeback_amount
    FROM filtered_orders o
    JOIN public.products p ON o.product_id = p.id
    GROUP BY p.currency
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
    'by_currency', COALESCE((SELECT jsonb_object_agg(currency, jsonb_build_object(
        'approved_count', approved_count,
        'approved_amount', approved_amount,
        'fees_amount', fees_amount,
        'net_amount', approved_amount - fees_amount,
        'pending_count', pending_count,
        'pending_amount', pending_amount,
        'refunded_count', refunded_count,
        'refunded_amount', refunded_amount,
        'chargeback_count', chargeback_count,
        'chargeback_amount', chargeback_amount,
        'total_count', approved_count + pending_count + refunded_count + chargeback_count,
        'avg_ticket', CASE WHEN approved_count > 0 THEN approved_amount / approved_count ELSE 0 END
    )) FROM currency_breakdown), '{}'::jsonb),
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
    )
  ) INTO result;

  RETURN result;
END;
$function$;