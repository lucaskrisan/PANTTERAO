
-- Re-add a RESTRICTED public coupon policy
-- Only allows reading ONE coupon at a time by exact code match
-- Prevents mass enumeration while allowing checkout validation
CREATE POLICY "Public validate single coupon by code"
ON public.coupons FOR SELECT
TO public
USING (
  active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (max_uses IS NULL OR used_count < max_uses)
);
