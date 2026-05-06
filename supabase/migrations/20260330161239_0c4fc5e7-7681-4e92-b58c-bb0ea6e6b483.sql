
-- 1. Drop the two public SELECT policies that allow listing all active coupons
DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Public validate single coupon by code" ON public.coupons;

-- 2. Revoke direct SELECT from anon/authenticated on coupons
-- (producers still have ALL via their own policy)
REVOKE SELECT ON public.coupons FROM anon;

-- 3. Create a SECURITY DEFINER function that validates a single coupon by exact code
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
RETURNS TABLE(
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  max_uses integer,
  used_count integer,
  min_amount numeric,
  product_id uuid,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.code, c.discount_type, c.discount_value,
    c.max_uses, c.used_count, c.min_amount, c.product_id, c.expires_at
  FROM public.coupons c
  WHERE c.code = upper(p_code)
    AND c.active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
  LIMIT 1;
$$;

-- 4. Grant execute to anon + authenticated so checkout can call it
GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO anon, authenticated;
