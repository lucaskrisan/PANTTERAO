-- One-time reconciliation: mark abandoned carts as recovered where a matching paid order exists
UPDATE public.abandoned_carts ac
SET recovered = true
WHERE ac.recovered = false
  AND ac.customer_email IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.customers c
    INNER JOIN public.orders o ON o.customer_id = c.id
    WHERE c.email = ac.customer_email
      AND o.product_id = ac.product_id
      AND o.status IN ('paid', 'approved')
  );

-- Create a periodic reconciliation function that can be called by cron
CREATE OR REPLACE FUNCTION public.reconcile_abandoned_carts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.abandoned_carts ac
  SET recovered = true
  WHERE ac.recovered = false
    AND ac.customer_email IS NOT NULL
    AND ac.created_at > now() - interval '7 days'
    AND EXISTS (
      SELECT 1
      FROM public.customers c
      INNER JOIN public.orders o ON o.customer_id = c.id
      WHERE c.email = ac.customer_email
        AND o.product_id = ac.product_id
        AND o.status IN ('paid', 'approved')
    );
  
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;