
-- 1) platform_settings: restrict authenticated SELECT to super_admin only
DROP POLICY IF EXISTS "Authenticated read platform settings" ON public.platform_settings;

CREATE POLICY "Super admins read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- 2) order_bumps: revoke user_id column from anon to prevent UUID leakage
REVOKE SELECT (user_id) ON public.order_bumps FROM anon;
