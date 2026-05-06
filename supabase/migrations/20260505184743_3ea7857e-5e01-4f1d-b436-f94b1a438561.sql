DROP FUNCTION IF EXISTS public.list_orders_paginated(uuid,boolean,integer,integer,text,text,text,uuid,text,text,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.list_orders_paginated(
    p_user_id uuid,
    p_is_super_admin boolean,
    p_page integer,
    p_page_size integer,
    p_search text DEFAULT NULL,
    p_status_filter text DEFAULT NULL,
    p_period text DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_payment_methods text DEFAULT NULL,
    p_sale_type text DEFAULT 'all',
    p_currency text DEFAULT NULL,
    p_product_type text DEFAULT 'all',
    p_subscription_filter text DEFAULT NULL,
    p_utm_search text DEFAULT NULL,
    p_affiliate_search text DEFAULT NULL,
    p_offer_filter text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  _result jsonb;
  _offset integer;
  _date_from timestamp with time zone;
  _status_array text[];
  _methods_array text[];
  _subscription_array text[];
  _total_count bigint;
  _total_amount numeric;
  _total_net numeric;
  _total_net_brl numeric;
  _total_net_usd numeric;
  _rows jsonb;
  _utm_query text;
  _affiliate_query text;
BEGIN
  IF NOT p_is_super_admin AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_is_super_admin AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admin';
  END IF;

  _offset := GREATEST(0, (p_page - 1)) * p_page_size;

  _date_from := CASE p_period
    WHEN 'today' THEN date_trunc('day', now())
    WHEN '7d' THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    WHEN '90d' THEN now() - interval '90 days'
    ELSE NULL
  END;

  IF p_status_filter = 'approved' THEN
    _status_array := ARRAY['paid', 'approved', 'confirmed'];
  ELSIF p_status_filter = 'all' OR p_status_filter IS NULL OR p_status_filter = '' THEN
    _status_array := NULL;
  ELSE
    _status_array := string_to_array(p_status_filter, ',');
    IF 'paid' = ANY(_status_array) THEN
      _status_array := _status_array || ARRAY['approved', 'confirmed'];
    END IF;
    IF 'approved' = ANY(_status_array) THEN
      _status_array := _status_array || ARRAY['paid', 'confirmed'];
    END IF;
    IF 'refused' = ANY(_status_array) THEN
      _status_array := _status_array || ARRAY['failed'];
    END IF;
    IF 'chargeback' = ANY(_status_array) THEN
      _status_array := _status_array || ARRAY['chargedback'];
    END IF;
    IF 'chargedback' = ANY(_status_array) THEN
      _status_array := _status_array || ARRAY['chargeback'];
    END IF;
  END IF;

  IF p_payment_methods IS NOT NULL AND p_payment_methods <> '' THEN
    _methods_array := string_to_array(p_payment_methods, ',');
  END IF;

  IF p_subscription_filter IS NOT NULL AND p_subscription_filter <> '' THEN
    _subscription_array := string_to_array(p_subscription_filter, ',');
  END IF;

  _utm_query := NULLIF(trim(COALESCE(p_utm_search, '')), '');
  _affiliate_query := NULLIF(trim(COALESCE(p_affiliate_search, '')), '');

  WITH filtered AS (
    SELECT o.*, UPPER(COALESCE(p.currency, 'BRL')) AS _cur
    FROM public.orders o
    LEFT JOIN public.customers c ON c.id = o.customer_id
    LEFT JOIN public.products p ON p.id = o.product_id
    WHERE (p_is_super_admin OR o.user_id = p_user_id)
      AND (_status_array IS NULL OR o.status = ANY(_status_array))
      AND (_date_from IS NULL OR o.created_at >= _date_from)
      AND (p_product_id IS NULL OR o.product_id = p_product_id)
      AND (_methods_array IS NULL OR o.payment_method = ANY(_methods_array))
      AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'all' OR COALESCE(p.currency, 'BRL') = p_currency)
      AND (p_product_type IS NULL OR p_product_type = 'all'
           OR (p_product_type = 'subscription' AND COALESCE(p.is_subscription, false) = true)
           OR (p_product_type = 'single' AND COALESCE(p.is_subscription, false) = false))
      AND (p_sale_type = 'all'
           OR (p_sale_type = 'upsell'
               AND (COALESCE((o.metadata->>'is_upsell')::boolean, false)
                    OR o.metadata ? 'upsell_from_order_id'
                    OR o.metadata ? 'original_order_id'))
           OR (p_sale_type = 'with_bumps'
               AND jsonb_typeof(o.metadata->'bump_product_ids') = 'array'
               AND jsonb_array_length(o.metadata->'bump_product_ids') > 0)
           OR (p_sale_type = 'front'
               AND NOT COALESCE((o.metadata->>'is_upsell')::boolean, false)
               AND NOT (o.metadata ? 'upsell_from_order_id')
               AND NOT (o.metadata ? 'original_order_id')
               AND (jsonb_typeof(o.metadata->'bump_product_ids') <> 'array'
                    OR jsonb_array_length(COALESCE(o.metadata->'bump_product_ids', '[]'::jsonb)) = 0)))
      AND (_subscription_array IS NULL
           OR ('new' = ANY(_subscription_array) AND COALESCE(p.is_subscription, false) = true AND NOT (o.metadata ? 'renewal_order_id') AND NOT (o.metadata ? 'renewal'))
           OR ('renewal' = ANY(_subscription_array) AND COALESCE(p.is_subscription, false) = true AND (o.metadata ? 'renewal_order_id' OR o.metadata ? 'renewal')))
      AND (p_offer_filter IS NULL OR p_offer_filter = '' OR p_offer_filter = 'all'
           OR o.metadata->>'config_id' = p_offer_filter
           OR o.metadata->>'coupon_id' = p_offer_filter)
      AND (_utm_query IS NULL OR (
        c.name ILIKE '%' || _utm_query || '%' OR
        c.email ILIKE '%' || _utm_query || '%' OR
        o.id::text ILIKE '%' || _utm_query || '%' OR
        o.external_id ILIKE '%' || _utm_query || '%' OR
        o.metadata->>'utm_source' ILIKE '%' || _utm_query || '%' OR
        o.metadata->>'utm_medium' ILIKE '%' || _utm_query || '%' OR
        o.metadata->>'utm_campaign' ILIKE '%' || _utm_query || '%'
      ))
      AND (_affiliate_query IS NULL OR (
        o.metadata->>'affiliate_id' = _affiliate_query OR
        o.metadata->>'affiliate_email' ILIKE '%' || _affiliate_query || '%'
      ))
      AND (p_search IS NULL OR (
        c.name ILIKE '%' || p_search || '%' OR
        c.email ILIKE '%' || p_search || '%' OR
        o.external_id ILIKE '%' || p_search || '%'
      ))
  )
  SELECT jsonb_build_object(
    'total_count', (SELECT count(*) FROM filtered),
    'total_amount', (SELECT COALESCE(sum(amount), 0) FROM filtered WHERE status IN ('paid', 'approved', 'confirmed')),
    'total_net', (SELECT COALESCE(sum(amount - COALESCE(platform_fee_amount, 0)), 0) FROM filtered WHERE status IN ('paid', 'approved', 'confirmed')),
    'total_net_brl', (SELECT COALESCE(sum(amount - COALESCE(platform_fee_amount, 0)), 0) FROM filtered WHERE status IN ('paid', 'approved', 'confirmed') AND _cur = 'BRL'),
    'total_net_usd', (SELECT COALESCE(sum(amount - COALESCE(platform_fee_amount, 0)), 0) FROM filtered WHERE status IN ('paid', 'approved', 'confirmed') AND _cur = 'USD'),
    'rows', (
      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb)
      FROM (
        SELECT f.*, 
               jsonb_build_object('name', c.name, 'email', c.email, 'phone', c.phone, 'cpf', c.cpf) as customers,
               jsonb_build_object('name', p.name, 'currency', p.currency) as products
        FROM filtered f
        LEFT JOIN public.customers c ON c.id = f.customer_id
        LEFT JOIN public.products p ON p.id = f.product_id
        ORDER BY f.created_at DESC
        LIMIT p_page_size OFFSET _offset
      ) r
    )
  ) INTO _result;

  RETURN _result;
END;
$function$;