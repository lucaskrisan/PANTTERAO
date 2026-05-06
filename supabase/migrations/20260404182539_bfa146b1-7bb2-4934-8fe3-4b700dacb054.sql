-- Fix: Restrict authenticated SELECT on pwa_settings to own data only
DROP POLICY IF EXISTS "Authenticated read pwa settings for active producers" ON public.pwa_settings;
CREATE POLICY "Authenticated read own pwa settings"
  ON public.pwa_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Fix: Restrict authenticated SELECT on checkout_settings to own data only
DROP POLICY IF EXISTS "Authenticated read checkout settings" ON public.checkout_settings;
CREATE POLICY "Authenticated read own checkout settings"
  ON public.checkout_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Fix: Restrict authenticated SELECT on checkout_builder_configs to own data only
DROP POLICY IF EXISTS "Authenticated read configs for active products" ON public.checkout_builder_configs;
CREATE POLICY "Authenticated read own configs"
  ON public.checkout_builder_configs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));
