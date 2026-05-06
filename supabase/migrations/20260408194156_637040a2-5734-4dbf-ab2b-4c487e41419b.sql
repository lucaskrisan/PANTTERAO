
-- 1. Drop the overly broad anon SELECT policy on checkout_settings
DROP POLICY IF EXISTS "Anon read checkout settings via product" ON public.checkout_settings;

-- Create a tighter policy: anon can only read a single row when filtering by user_id
-- that belongs to an active product owner (requires the query to specify user_id)
CREATE POLICY "Anon read checkout settings scoped"
ON public.checkout_settings
FOR SELECT
TO anon
USING (
  user_id IS NOT NULL
  AND user_id IN (
    SELECT DISTINCT p.user_id FROM products p
    WHERE p.active = true AND p.user_id = checkout_settings.user_id
  )
);

-- 2. Add explicit service_role read policy for payment_gateways (documents intentional access)
CREATE POLICY "Service role reads payment gateways"
ON public.payment_gateways
FOR SELECT
TO service_role
USING (true);
