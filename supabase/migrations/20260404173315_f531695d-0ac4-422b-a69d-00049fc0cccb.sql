-- 1) platform_settings: restrict public SELECT to authenticated only
DROP POLICY IF EXISTS "Anyone read platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated read platform settings"
ON public.platform_settings FOR SELECT TO authenticated
USING (true);

-- 2) pwa_settings: restrict raw table public SELECT to authenticated
-- The public_pwa_settings view (security_invoker=true) already omits user_id
DROP POLICY IF EXISTS "Public read pwa settings for active producers" ON public.pwa_settings;
CREATE POLICY "Authenticated read pwa settings for active producers"
ON public.pwa_settings FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_super_admin(auth.uid())
  OR user_id IN (SELECT p.user_id FROM products p WHERE p.active = true)
);

-- Keep anon access ONLY through the safe view (no user_id exposed)
-- Grant anon SELECT on the view
GRANT SELECT ON public.public_pwa_settings TO anon;