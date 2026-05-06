CREATE OR REPLACE FUNCTION public.list_orders_paginated(p_user_id uuid, p_is_super_admin boolean DEFAULT false, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_search text DEFAULT NULL::text, p_status_filter text DEFAULT 'approved'::text, p_period text DEFAULT 'all'::text, p_product_id uuid DEFAULT NULL::uuid, p_payment_methods text DEFAULT NULL::text, p_sale_type text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _offset integer;
  _date_from timestamp with time zone;
  _status_array text[];
  _methods_array text[];
  _total_count bigint;
  _total_amount numeric;
  _rows jsonb;
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
    WHEN '7d'    THEN now() - interval '7 days'
    WHEN '30d'   THEN now() - interval '30 days'
    WHEN '90d'   THEN now() - interval '90 days'
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
    IF 'refused' = ANY(_status_array) THEN
      _status_array := _status_array || ARRAY['failed'];
    END IF;
  END IF;

  IF p_payment_methods IS NOT NULL AND p_payment_methods <> '' THEN
    _methods_array := string_to_array(p_payment_methods, ',');
  END IF;

  WITH filtered AS (
    SELECT o.*
    FROM public.orders o
    LEFT JOIN public.customers c ON c.id = o.customer_id
    LEFT JOIN public.products  p ON p.id = o.product_id
    WHERE (p_is_super_admin OR o.user_id = p_user_id)
      AND (_status_array IS NULL OR o.status = ANY(_status_array))
      AND (_date_from IS NULL OR o.created_at >= _date_from)
      AND (p_product_id IS NULL OR o.product_id = p_product_id)
      AND (_methods_array IS NULL OR o.payment_method = ANY(_methods_array))
      AND (p_sale_type = 'all'
           OR (p_sale_type = 'upsell'
               AND (COALESCE((o.metadata->>'is_upsell')::boolean, false)
                    OR o.metadata ? 'upsell_from_order_id'))
           OR (p_sale_type = 'with_bumps'
               AND jsonb_typeof(o.metadata->'bump_product_ids') = 'array'
               AND jsonb_array_length(o.metadata->'bump_product_ids') > 0)
           OR (p_sale_type = 'front'
               AND NOT COALESCE((o.metadata->>'is_upsell')::boolean, false)
               AND NOT (o.metadata ? 'upsell_from_order_id')
               AND (jsonb_typeof(o.metadata->'bump_product_ids') <> 'array'
                    OR jsonb_array_length(COALESCE(o.metadata->'bump_product_ids', '[]'::jsonb)) = 0)))
      AND (p_search IS NULL OR p_search = '' OR (
            o.id::text ILIKE '%' || p_search || '%'
         OR c.name ILIKE '%' || p_search || '%'
         OR c.email ILIKE '%' || p_search || '%'
         OR p.name ILIKE '%' || p_search || '%'
      ))
  ),
  totals AS (
    SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS amt FROM filtered
  ),
  page AS (
    SELECT f.*,
           jsonb_build_object('name', c.name, 'email', c.email, 'phone', c.phone, 'cpf', c.cpf) AS customer_obj,
           jsonb_build_object('name', p.name, 'currency', COALESCE(p.currency, 'BRL')) AS product_obj
    FROM filtered f
    LEFT JOIN public.customers c ON c.id = f.customer_id
    LEFT JOIN public.products  p ON p.id = f.product_id
    ORDER BY f.created_at DESC
    LIMIT p_page_size OFFSET _offset
  )
  SELECT
    (SELECT cnt FROM totals),
    (SELECT amt FROM totals),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', page.id,
      'amount', page.amount,
      'payment_method', page.payment_method,
      'status', page.status,
      'created_at', page.created_at,
      'updated_at', page.updated_at,
      'product_id', page.product_id,
      'metadata', page.metadata,
      'platform_fee_amount', page.platform_fee_amount,
      'customers', page.customer_obj,
      'products', page.product_obj
    )), '[]'::jsonb)
  INTO _total_count, _total_amount, _rows
  FROM page;

  _result := jsonb_build_object(
    'rows', COALESCE(_rows, '[]'::jsonb),
    'total_count', COALESCE(_total_count, 0),
    'total_amount', COALESCE(_total_amount, 0)
  );

  RETURN _result;
END;
$function$;