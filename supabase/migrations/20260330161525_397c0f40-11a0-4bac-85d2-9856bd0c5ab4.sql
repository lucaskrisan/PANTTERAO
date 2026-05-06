
-- 1. Fix orders public INSERT to scope user_id to the product owner
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
CREATE POLICY "Public insert orders" ON public.orders
  FOR INSERT TO public
  WITH CHECK (
    amount > 0
    AND payment_method IS NOT NULL
    AND product_id IS NOT NULL
    AND (
      user_id IS NULL
      OR user_id = (SELECT p.user_id FROM public.products p WHERE p.id = orders.product_id)
    )
  );

-- 2. The active_gateways view already uses security_invoker which inherits
-- payment_gateways RLS. Mark it explicitly by granting only authenticated.
REVOKE ALL ON public.active_gateways FROM anon;
GRANT SELECT ON public.active_gateways TO authenticated;
