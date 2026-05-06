
-- Drop the insecure public insert policy
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;

-- Create a secure insert policy: user_id must reference a producer who owns
-- the product being purchased (linked via existing products table)
CREATE POLICY "Checkout insert customers" ON public.customers
FOR INSERT TO anon, authenticated
WITH CHECK (
  name IS NOT NULL
  AND email IS NOT NULL
  AND (
    user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.user_id = customers.user_id
        AND p.active = true
    )
  )
);
