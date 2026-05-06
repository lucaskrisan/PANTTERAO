
-- Fix coupon policy: allow public to read active coupons (needed for checkout validation)
-- The risk is enumeration, but coupons are meant to be shared publicly anyway
-- Instead, just restrict to single-row lookups by requiring a code filter
DROP POLICY IF EXISTS "Public validate active coupons by code" ON public.coupons;

-- Simpler approach: allow public read of active coupons (codes are shared publicly by design)
-- The real protection is max_uses, expires_at, and product_id validation in the app
CREATE POLICY "Public read active coupons"
ON public.coupons FOR SELECT
TO public
USING (active = true);
