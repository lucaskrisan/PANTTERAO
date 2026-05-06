
-- 1. Fix: CAPI tokens exposed publicly
-- Create a secure view that hides sensitive columns
CREATE OR REPLACE VIEW public.public_product_pixels
WITH (security_invoker = true)
AS
SELECT id, pixel_id, platform, product_id, domain, fire_on_pix, fire_on_boleto
FROM public.product_pixels;

-- Drop the overly permissive public read policy on product_pixels
DROP POLICY IF EXISTS "Public read pixels for checkout" ON public.product_pixels;

-- Create a restrictive policy: only authenticated owners can read full data
CREATE POLICY "Owners read own pixels"
ON public.product_pixels
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Allow public to read the safe view
GRANT SELECT ON public.public_product_pixels TO anon;
GRANT SELECT ON public.public_product_pixels TO authenticated;

-- 2. Fix: member_access tokens readable by anyone
-- Replace blanket SELECT with token-scoped access
DROP POLICY IF EXISTS "Anyone can read own access" ON public.member_access;

CREATE POLICY "Access by token only"
ON public.member_access
FOR SELECT
TO anon, authenticated
USING (
  access_token::text = coalesce(current_setting('request.headers', true)::json->>'x-access-token', '')
  OR (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  ))
);

-- 3. Fix: course content accessible without purchase
DROP POLICY IF EXISTS "Members can read lessons" ON public.course_lessons;
DROP POLICY IF EXISTS "Members can read modules" ON public.course_modules;

CREATE POLICY "Members read lessons via access"
ON public.course_lessons
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.member_access ma
    JOIN public.course_modules cm ON cm.course_id = ma.course_id
    WHERE cm.id = course_lessons.module_id
    AND ma.access_token::text = coalesce(current_setting('request.headers', true)::json->>'x-access-token', '')
    AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Members read modules via access"
ON public.course_modules
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.member_access ma
    WHERE ma.course_id = course_modules.course_id
    AND ma.access_token::text = coalesce(current_setting('request.headers', true)::json->>'x-access-token', '')
    AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'))
);
