
-- Fix: All RLS policies are RESTRICTIVE, meaning no rows return (Postgres needs at least 1 PERMISSIVE).
-- Drop restrictive public policies and recreate as PERMISSIVE.

-- PRODUCTS: public read
DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products" ON public.products
  FOR SELECT TO public USING (active = true);

-- CUSTOMERS: public insert
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;
CREATE POLICY "Public insert customers" ON public.customers
  FOR INSERT TO public WITH CHECK (name IS NOT NULL AND email IS NOT NULL);

-- ORDERS: public insert
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
CREATE POLICY "Public insert orders" ON public.orders
  FOR INSERT TO public WITH CHECK (amount > 0 AND payment_method IS NOT NULL);

-- CHECKOUT_SETTINGS: public read
DROP POLICY IF EXISTS "Public read checkout settings" ON public.checkout_settings;
CREATE POLICY "Public read checkout settings" ON public.checkout_settings
  FOR SELECT TO public USING (true);

-- COURSES: public read
DROP POLICY IF EXISTS "Public read courses" ON public.courses;
CREATE POLICY "Public read courses" ON public.courses
  FOR SELECT TO public USING (true);

-- PLATFORM_SETTINGS: public read
DROP POLICY IF EXISTS "Anyone read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone read platform settings" ON public.platform_settings
  FOR SELECT TO public USING (true);
