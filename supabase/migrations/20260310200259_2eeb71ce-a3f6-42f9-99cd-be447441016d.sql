
-- Fix: Recreate public policies explicitly AS PERMISSIVE

-- PRODUCTS
DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products" ON public.products
  AS PERMISSIVE FOR SELECT TO public USING (active = true);

-- CUSTOMERS
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;
CREATE POLICY "Public insert customers" ON public.customers
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (name IS NOT NULL AND email IS NOT NULL);

-- ORDERS
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
CREATE POLICY "Public insert orders" ON public.orders
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (amount > 0 AND payment_method IS NOT NULL);

-- CHECKOUT_SETTINGS
DROP POLICY IF EXISTS "Public read checkout settings" ON public.checkout_settings;
CREATE POLICY "Public read checkout settings" ON public.checkout_settings
  AS PERMISSIVE FOR SELECT TO public USING (true);

-- COURSES
DROP POLICY IF EXISTS "Public read courses" ON public.courses;
CREATE POLICY "Public read courses" ON public.courses
  AS PERMISSIVE FOR SELECT TO public USING (true);

-- PLATFORM_SETTINGS
DROP POLICY IF EXISTS "Anyone read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone read platform settings" ON public.platform_settings
  AS PERMISSIVE FOR SELECT TO public USING (true);

-- Also fix authenticated policies - they need at least one PERMISSIVE too
DROP POLICY IF EXISTS "Producers manage own products" ON public.products;
CREATE POLICY "Producers manage own products" ON public.products
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Producers manage own orders" ON public.orders;
CREATE POLICY "Producers manage own orders" ON public.orders
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Producers manage own customers" ON public.customers;
CREATE POLICY "Producers manage own customers" ON public.customers
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Producers manage own gateways" ON public.payment_gateways;
CREATE POLICY "Producers manage own gateways" ON public.payment_gateways
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Producers manage own settings" ON public.checkout_settings;
CREATE POLICY "Producers manage own settings" ON public.checkout_settings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Producers manage own courses" ON public.courses;
CREATE POLICY "Producers manage own courses" ON public.courses
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage platform settings" ON public.platform_settings;
CREATE POLICY "Super admins manage platform settings" ON public.platform_settings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
