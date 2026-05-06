-- Fix: enforce moderation_status in public product read policy.
-- Previously only checked active=true — a producer could activate a rejected
-- product via API and bypass moderation entirely.
-- Now requires BOTH active=true AND moderation_status='approved'.

DROP POLICY IF EXISTS "Public read active products" ON public.products;

CREATE POLICY "Public read active products"
  ON public.products
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    active = true
    AND (moderation_status IS NULL OR moderation_status = 'approved')
  );

-- Super admins and product owners can still read their own products
-- regardless of moderation status (already handled by authenticated policies).
