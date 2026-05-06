CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_user_id uuid,
  p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_product_id uuid DEFAULT NULL::uuid,
  p_is_super_admin boolean DEFAULT false,
  p_currency text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  _date_from_sp date;
  _date_to_sp date;
BEGIN
  _date_from_sp := CASE WHEN p_date_from IS NULL THEN NULL ELSE (p_date_from AT TIME ZONE 'America/Sao_Paulo')::date END;
  _date_to_sp := CASE WHEN p_date_to IS NULL THEN NULL ELSE (p_date_to AT TIME ZONE 'America/Sao_Paulo')::date END;

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
  all_orders AS (
    SELECT o.id, o.created_at, o.status, o.amount, o.platform_fee_amount,
           o.payment_method, o.metadata,
           COALESCE(p.currency, 'BRL') AS currency
    FROM public.orders o
    LEFT JOIN public.products p ON p.id = o.product_id
    WHERE (p_is_super_admin OR o.user_id = p_user_id)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to)
      AND (p_product_id IS NULL OR o.product_id = p_product_id)
  ),
  by_currency_base AS (
    SELECT
      currency,
      COUNT(*) FILTER (WHERE status IN ('paid','approved','confirmed')) AS approved_count,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('paid','approved','confirmed')), 0) AS approved_amount,
      COALESCE(SUM(COALESCE(platform_fee_amount, 0)) FILTER (WHERE status IN ('paid','approved','confirmed')), 0) AS fees_amount,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending_amount,
      COUNT(*) FILTER (WHERE status = 'refunded') AS refunded_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'refunded'), 0) AS refunded_amount,
      COUNT(*) FILTER (WHERE status = 'chargedback') AS chargeback_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'chargedback'), 0) AS chargeback_amount,
      COUNT(*) FILTER (WHERE status IN ('paid','approved','confirmed')
                       AND metadata->>'utm_source' IS NOT NULL
                       AND metadata->>'utm_source' != '') AS ads_count,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('paid','approved','confirmed')
                       AND metadata->>'utm_source' IS NOT NULL
                       AND metadata->>'utm_source' != ''), 0) AS ads_revenue,
      COUNT(*) FILTER (WHERE status IN ('paid','approved','confirmed')
                       AND (metadata->>'utm_source' IS NULL OR metadata->>'utm_source' = '')) AS organic_count,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('paid','approved','confirmed')
                       AND (metadata->>'utm_source' IS NULL OR metadata->>'utm_source' = '')), 0) AS organic_revenue,
      COUNT(*) AS total_count
    FROM all_orders
    GROUP BY currency
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
        SELECT extract(hour from created_at AT TIME ZONE 'America/Sao_Paulo')::int AS hr, sum(amount) AS t
        FROM approved GROUP BY hr
      ) agg ON agg.hr = h
    ),
    'chart_daily', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d::date, 'total', COALESCE(t, 0)) ORDER BY d), '[]'::jsonb)
      FROM generate_series(
        COALESCE(_date_from_sp, (now() AT TIME ZONE 'America/Sao_Paulo')::date - 30),
        COALESCE(_date_to_sp, (now() AT TIME ZONE 'America/Sao_Paulo')::date),
        '1 day'::interval
      ) AS d
      LEFT JOIN (
        SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dt, sum(amount) AS t
        FROM approved GROUP BY dt
      ) agg ON agg.dt = d::date
    ),
    'by_currency', COALESCE((
      SELECT jsonb_object_agg(
        currency,
        jsonb_build_object(
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
          'ads_count', ads_count,
          'ads_revenue', ads_revenue,
          'organic_count', organic_count,
          'organic_revenue', organic_revenue,
          'total_count', total_count,
          'avg_ticket', CASE WHEN approved_count > 0 THEN approved_amount / approved_count ELSE 0 END
        )
      ) FROM by_currency_base
    ), '{}'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;