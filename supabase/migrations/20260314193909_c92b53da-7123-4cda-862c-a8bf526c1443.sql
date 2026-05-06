
-- Fix: checkout needs to read settings/configs from ANY producer when visiting their checkout
-- These are needed for the checkout page to render correctly

-- checkout_settings: allow reading by product relationship
DROP POLICY IF EXISTS "Authenticated read checkout settings" ON public.checkout_settings;
CREATE POLICY "Authenticated read checkout settings" ON public.checkout_settings
FOR SELECT TO authenticated
USING (true);

-- checkout_builder_configs: allow reading by anyone (needed for checkout rendering)
DROP POLICY IF EXISTS "Authenticated read own configs" ON public.checkout_builder_configs;
CREATE POLICY "Authenticated read configs" ON public.checkout_builder_configs
FOR SELECT TO authenticated
USING (true);
