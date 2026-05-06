CREATE OR REPLACE FUNCTION public.get_analytics_summary(
  p_user_id UUID,
  p_date_from TIMESTAMP WITH TIME ZONE,
  p_is_super_admin BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSONB;
BEGIN
  WITH filtered_events AS (
    SELECT event_name, visitor_id
    FROM public.pixel_events
    WHERE (p_is_super_admin OR user_id = p_user_id)
      AND (p_date_from IS NULL OR created_at >= p_date_from)
  ),
  funnel_counts AS (
    SELECT event_name, count(*) as cnt
    FROM filtered_events
    GROUP BY event_name
  ),
  visitor_count AS (
    SELECT count(DISTINCT visitor_id) as cnt
    FROM filtered_events
  ),
  filtered_orders AS (
    SELECT status, amount, customer_state, created_at, metadata
    FROM public.orders
    WHERE (p_is_super_admin OR user_id = p_user_id)
      AND (p_date_from IS NULL OR created_at >= p_date_from)
  ),
  paid_orders AS (
    SELECT * FROM filtered_orders 
    WHERE status IN ('paid', 'approved', 'confirmed')
  ),
  revenue_by_day AS (
    SELECT 
      to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') as day,
      sum(amount) as total
    FROM paid_orders
    GROUP BY 1
    ORDER BY MIN(created_at)
  ),
  state_distribution AS (
    SELECT 
      upper(trim(customer_state)) as state,
      count(*) as count,
      sum(amount) as revenue
    FROM paid_orders
    WHERE customer_state IS NOT NULL AND length(trim(customer_state)) = 2
    GROUP BY 1
  ),
  cart_metrics AS (
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE recovered = true) as recovered
    FROM public.abandoned_carts
    WHERE (p_is_super_admin OR user_id = p_user_id)
      AND (p_date_from IS NULL OR created_at >= p_date_from)
  )
  SELECT jsonb_build_object(
    'funnel', (SELECT jsonb_object_agg(event_name, cnt) FROM funnel_counts),
    'unique_visitors', (SELECT cnt FROM visitor_count),
    'revenue_by_day', (SELECT jsonb_agg(jsonb_build_object('name', day, 'total', total)) FROM revenue_by_day),
    'sales_by_state', (SELECT jsonb_object_agg(state, jsonb_build_object('count', count, 'revenue', revenue)) FROM state_distribution),
    'cart_metrics', (SELECT jsonb_build_object('total', total, 'recovered', recovered) FROM cart_metrics),
    'total_revenue', (SELECT COALESCE(sum(amount), 0) FROM paid_orders),
    'paid_count', (SELECT count(*) FROM paid_orders),
    'chargeback_count', (SELECT count(*) FROM filtered_orders WHERE status IN ('chargeback', 'chargedback'))
  ) INTO _result;

  RETURN _result;
END;
$$;