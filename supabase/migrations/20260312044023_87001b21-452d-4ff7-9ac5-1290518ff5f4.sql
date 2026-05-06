
-- Fix: All RLS policies on checkout_builder_configs are RESTRICTIVE (Permissive: No)
-- PostgreSQL requires at least one PERMISSIVE policy to grant access.
-- Drop the restrictive ones and recreate as PERMISSIVE.

DROP POLICY IF EXISTS "Producers manage own configs" ON public.checkout_builder_configs;
DROP POLICY IF EXISTS "Public read configs" ON public.checkout_builder_configs;

CREATE POLICY "Producers manage own configs"
ON public.checkout_builder_configs
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public read configs"
ON public.checkout_builder_configs
FOR SELECT
TO public
USING (true);

-- Also fix abandoned_carts which has the same issue
DROP POLICY IF EXISTS "Producers manage own abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Public insert abandoned carts" ON public.abandoned_carts;

CREATE POLICY "Producers manage own abandoned carts"
ON public.abandoned_carts
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public insert abandoned carts"
ON public.abandoned_carts
FOR INSERT
TO public
WITH CHECK (product_id IS NOT NULL);

-- Fix other tables with same pattern: checkout_settings, coupons, courses, customers, orders, order_bumps, products, payment_gateways, product_pixels, notification_settings, facebook_domains, platform_settings

-- checkout_settings
DROP POLICY IF EXISTS "Producers manage own settings" ON public.checkout_settings;
DROP POLICY IF EXISTS "Public read checkout settings" ON public.checkout_settings;

CREATE POLICY "Producers manage own settings"
ON public.checkout_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public read checkout settings"
ON public.checkout_settings
FOR SELECT
TO public
USING (true);

-- coupons
DROP POLICY IF EXISTS "Producers manage own coupons" ON public.coupons;
DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;

CREATE POLICY "Producers manage own coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public read active coupons"
ON public.coupons
FOR SELECT
TO public
USING (active = true);

-- courses
DROP POLICY IF EXISTS "Producers manage own courses" ON public.courses;
DROP POLICY IF EXISTS "Public read courses" ON public.courses;

CREATE POLICY "Producers manage own courses"
ON public.courses
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public read courses"
ON public.courses
FOR SELECT
TO public
USING (true);

-- customers
DROP POLICY IF EXISTS "Producers manage own customers" ON public.customers;
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;

CREATE POLICY "Producers manage own customers"
ON public.customers
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public insert customers"
ON public.customers
FOR INSERT
TO public
WITH CHECK (name IS NOT NULL AND email IS NOT NULL);

-- orders
DROP POLICY IF EXISTS "Producers manage own orders" ON public.orders;
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;

CREATE POLICY "Producers manage own orders"
ON public.orders
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public insert orders"
ON public.orders
FOR INSERT
TO public
WITH CHECK (amount > 0 AND payment_method IS NOT NULL);

-- order_bumps
DROP POLICY IF EXISTS "Producers manage own order bumps" ON public.order_bumps;
DROP POLICY IF EXISTS "Public read order bumps" ON public.order_bumps;

CREATE POLICY "Producers manage own order bumps"
ON public.order_bumps
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public read order bumps"
ON public.order_bumps
FOR SELECT
TO public
USING (active = true);

-- products
DROP POLICY IF EXISTS "Producers manage own products" ON public.products;
DROP POLICY IF EXISTS "Public read active products" ON public.products;

CREATE POLICY "Producers manage own products"
ON public.products
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public read active products"
ON public.products
FOR SELECT
TO public
USING (active = true);

-- payment_gateways
DROP POLICY IF EXISTS "Producers manage own gateways" ON public.payment_gateways;

CREATE POLICY "Producers manage own gateways"
ON public.payment_gateways
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- product_pixels
DROP POLICY IF EXISTS "Owners read own pixels" ON public.product_pixels;
DROP POLICY IF EXISTS "Producers manage own pixels" ON public.product_pixels;

CREATE POLICY "Producers manage own pixels"
ON public.product_pixels
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- notification_settings
DROP POLICY IF EXISTS "Users manage own notification settings" ON public.notification_settings;

CREATE POLICY "Users manage own notification settings"
ON public.notification_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- facebook_domains
DROP POLICY IF EXISTS "Users manage own facebook domains" ON public.facebook_domains;

CREATE POLICY "Users manage own facebook domains"
ON public.facebook_domains
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- platform_settings
DROP POLICY IF EXISTS "Anyone read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Super admins manage platform settings" ON public.platform_settings;

CREATE POLICY "Anyone read platform settings"
ON public.platform_settings
FOR SELECT
TO public
USING (true);

CREATE POLICY "Super admins manage platform settings"
ON public.platform_settings
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- profiles - fix these too
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- user_roles
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- course_lessons
DROP POLICY IF EXISTS "Admins can manage lessons" ON public.course_lessons;
DROP POLICY IF EXISTS "Members read lessons via access" ON public.course_lessons;

CREATE POLICY "Admins can manage lessons"
ON public.course_lessons
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members read lessons via access"
ON public.course_lessons
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM member_access ma
    JOIN course_modules cm ON cm.course_id = ma.course_id
    WHERE cm.id = course_lessons.module_id
      AND ma.access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

-- course_modules
DROP POLICY IF EXISTS "Admins can manage modules" ON public.course_modules;
DROP POLICY IF EXISTS "Members read modules via access" ON public.course_modules;

CREATE POLICY "Admins can manage modules"
ON public.course_modules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members read modules via access"
ON public.course_modules
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM member_access ma
    WHERE ma.course_id = course_modules.course_id
      AND ma.access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

-- member_access
DROP POLICY IF EXISTS "Access by token only" ON public.member_access;
DROP POLICY IF EXISTS "Admins can manage access" ON public.member_access;

CREATE POLICY "Admins can manage access"
ON public.member_access
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Access by token only"
ON public.member_access
FOR SELECT
TO anon, authenticated
USING (
  access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
  OR (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
  ))
);

-- lesson_progress
DROP POLICY IF EXISTS "Admins can manage progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Members insert progress via token" ON public.lesson_progress;
DROP POLICY IF EXISTS "Members update progress via token" ON public.lesson_progress;
DROP POLICY IF EXISTS "Read own progress via token" ON public.lesson_progress;

CREATE POLICY "Admins can manage progress"
ON public.lesson_progress
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Read own progress via token"
ON public.lesson_progress
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_progress.member_access_id
      AND ma.access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Members insert progress via token"
ON public.lesson_progress
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_progress.member_access_id
      AND ma.access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Members update progress via token"
ON public.lesson_progress
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_progress.member_access_id
      AND ma.access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);
