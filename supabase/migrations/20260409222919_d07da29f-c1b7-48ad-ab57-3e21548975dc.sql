CREATE POLICY "Public update own abandoned cart"
ON public.abandoned_carts
FOR UPDATE
TO public
USING (true)
WITH CHECK (
  product_id IS NOT NULL
  AND (user_id IS NULL OR user_id = (SELECT p.user_id FROM products p WHERE p.id = abandoned_carts.product_id))
);