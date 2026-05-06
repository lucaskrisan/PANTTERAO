
-- Add user_id to all producer-scoped tables
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.payment_gateways ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.checkout_settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Platform fee columns on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS platform_fee_percent numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS platform_fee_amount numeric DEFAULT 0;

-- Update has_role to support super_admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- RLS: products
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read active products" ON public.products;
DROP POLICY IF EXISTS "Producers manage own products" ON public.products;
DROP POLICY IF EXISTS "Public read active products" ON public.products;

CREATE POLICY "Producers manage own products"
  ON public.products FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Public read active products"
  ON public.products FOR SELECT TO public
  USING (active = true);

-- RLS: orders
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Producers manage own orders" ON public.orders;
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;

CREATE POLICY "Producers manage own orders"
  ON public.orders FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Public insert orders"
  ON public.orders FOR INSERT TO public
  WITH CHECK (amount > 0 AND payment_method IS NOT NULL);

-- RLS: customers
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Producers manage own customers" ON public.customers;
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;

CREATE POLICY "Producers manage own customers"
  ON public.customers FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Public insert customers"
  ON public.customers FOR INSERT TO public
  WITH CHECK (name IS NOT NULL AND email IS NOT NULL);

-- RLS: payment_gateways
DROP POLICY IF EXISTS "Admins can manage gateways" ON public.payment_gateways;
DROP POLICY IF EXISTS "Producers manage own gateways" ON public.payment_gateways;

CREATE POLICY "Producers manage own gateways"
  ON public.payment_gateways FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- RLS: courses
DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;
DROP POLICY IF EXISTS "Members can read courses via token" ON public.courses;
DROP POLICY IF EXISTS "Producers manage own courses" ON public.courses;
DROP POLICY IF EXISTS "Public read courses" ON public.courses;

CREATE POLICY "Producers manage own courses"
  ON public.courses FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Public read courses"
  ON public.courses FOR SELECT TO public
  USING (true);

-- RLS: checkout_settings
DROP POLICY IF EXISTS "Admins can update checkout settings" ON public.checkout_settings;
DROP POLICY IF EXISTS "Anyone can read checkout settings" ON public.checkout_settings;
DROP POLICY IF EXISTS "Producers manage own settings" ON public.checkout_settings;
DROP POLICY IF EXISTS "Public read checkout settings" ON public.checkout_settings;

CREATE POLICY "Producers manage own settings"
  ON public.checkout_settings FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Public read checkout settings"
  ON public.checkout_settings FOR SELECT TO public
  USING (true);

-- Update active_gateways view
DROP VIEW IF EXISTS public.active_gateways;
CREATE VIEW public.active_gateways WITH (security_invoker=on) AS
  SELECT id, provider, name, payment_methods, environment, user_id
  FROM public.payment_gateways
  WHERE active = true;

-- Platform settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_fee_percent numeric DEFAULT 4.99,
  platform_name text DEFAULT 'PayCheckout',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage platform settings"
  ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Anyone read platform settings"
  ON public.platform_settings FOR SELECT TO public
  USING (true);

INSERT INTO public.platform_settings (platform_fee_percent, platform_name)
SELECT 4.99, 'PayCheckout'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

-- Change new user trigger to assign 'admin' role (producer), not super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
