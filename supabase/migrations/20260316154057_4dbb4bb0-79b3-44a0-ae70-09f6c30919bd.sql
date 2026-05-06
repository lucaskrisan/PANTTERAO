
-- 1. Fix checkout_builder_configs: restrict anon/auth SELECT to active products only
DROP POLICY IF EXISTS "Anon read configs" ON public.checkout_builder_configs;
DROP POLICY IF EXISTS "Authenticated read configs" ON public.checkout_builder_configs;

CREATE POLICY "Anon read configs for active products" ON public.checkout_builder_configs
  FOR SELECT TO anon
  USING (product_id IN (SELECT id FROM public.products WHERE active = true));

CREATE POLICY "Authenticated read configs for active products" ON public.checkout_builder_configs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_super_admin(auth.uid())
    OR product_id IN (SELECT id FROM public.products WHERE active = true)
  );

-- 2. Fix checkout_settings: restrict anon/auth SELECT to own or via product context
DROP POLICY IF EXISTS "Anon read checkout settings" ON public.checkout_settings;
DROP POLICY IF EXISTS "Authenticated read checkout settings" ON public.checkout_settings;

CREATE POLICY "Anon read checkout settings via product" ON public.checkout_settings
  FOR SELECT TO anon
  USING (user_id IN (SELECT user_id FROM public.products WHERE active = true));

CREATE POLICY "Authenticated read checkout settings" ON public.checkout_settings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_super_admin(auth.uid())
    OR user_id IN (SELECT user_id FROM public.products WHERE active = true)
  );

-- 3. Fix courses: restrict anon to only courses linked to active products
DROP POLICY IF EXISTS "Anon read courses" ON public.courses;

CREATE POLICY "Anon read courses with active products" ON public.courses
  FOR SELECT TO anon
  USING (product_id IN (SELECT id FROM public.products WHERE active = true));
