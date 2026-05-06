
-- ============================================
-- CRITICAL: Fix data isolation between producers
-- ============================================

-- Helper function: check if user owns a course
CREATE OR REPLACE FUNCTION public.owns_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = _course_id AND user_id = _user_id
  )
$$;

-- Helper function: check if user owns a course via module
CREATE OR REPLACE FUNCTION public.owns_module(_user_id uuid, _module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_modules cm
    JOIN public.courses c ON c.id = cm.course_id
    WHERE cm.id = _module_id AND c.user_id = _user_id
  )
$$;

-- Helper function: check if user owns a course via lesson
CREATE OR REPLACE FUNCTION public.owns_lesson(_user_id uuid, _lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_lessons cl
    JOIN public.course_modules cm ON cm.id = cl.module_id
    JOIN public.courses c ON c.id = cm.course_id
    WHERE cl.id = _lesson_id AND c.user_id = _user_id
  )
$$;

-- ========== course_modules ==========
DROP POLICY IF EXISTS "Admins can manage modules" ON public.course_modules;
CREATE POLICY "Admins can manage own modules" ON public.course_modules
FOR ALL TO authenticated
USING (owns_course(auth.uid(), course_id) OR is_super_admin(auth.uid()))
WITH CHECK (owns_course(auth.uid(), course_id) OR is_super_admin(auth.uid()));

-- Fix the members read policy to not give blanket admin access
DROP POLICY IF EXISTS "Members read modules via access" ON public.course_modules;
CREATE POLICY "Members read modules via access" ON public.course_modules
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.course_id = course_modules.course_id
    AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
    AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
  OR owns_course(auth.uid(), course_id)
  OR is_super_admin(auth.uid())
);

-- ========== course_lessons ==========
DROP POLICY IF EXISTS "Admins can manage lessons" ON public.course_lessons;
CREATE POLICY "Admins can manage own lessons" ON public.course_lessons
FOR ALL TO authenticated
USING (owns_module(auth.uid(), module_id) OR is_super_admin(auth.uid()))
WITH CHECK (owns_module(auth.uid(), module_id) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Members read lessons via access" ON public.course_lessons;
CREATE POLICY "Members read lessons via access" ON public.course_lessons
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    JOIN course_modules cm ON cm.course_id = ma.course_id
    WHERE cm.id = course_lessons.module_id
    AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
    AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
  OR owns_module(auth.uid(), module_id)
  OR is_super_admin(auth.uid())
);

-- ========== lesson_materials ==========
DROP POLICY IF EXISTS "Admins manage lesson materials" ON public.lesson_materials;
CREATE POLICY "Admins manage own lesson materials" ON public.lesson_materials
FOR ALL TO authenticated
USING (owns_lesson(auth.uid(), lesson_id) OR is_super_admin(auth.uid()))
WITH CHECK (owns_lesson(auth.uid(), lesson_id) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Members read materials via access" ON public.lesson_materials;
CREATE POLICY "Members read materials via access" ON public.lesson_materials
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    JOIN course_modules cm ON cm.course_id = ma.course_id
    JOIN course_lessons cl ON cl.module_id = cm.id
    WHERE cl.id = lesson_materials.lesson_id
    AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
    AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
  OR owns_lesson(auth.uid(), lesson_id)
  OR is_super_admin(auth.uid())
);

-- ========== lesson_progress ==========
DROP POLICY IF EXISTS "Admins can manage progress" ON public.lesson_progress;
CREATE POLICY "Admins can manage own progress" ON public.lesson_progress
FOR ALL TO authenticated
USING (owns_lesson(auth.uid(), lesson_id) OR is_super_admin(auth.uid()))
WITH CHECK (owns_lesson(auth.uid(), lesson_id) OR is_super_admin(auth.uid()));

-- Fix insert/update/read policies to use ownership instead of blanket admin
DROP POLICY IF EXISTS "Members insert progress via token" ON public.lesson_progress;
CREATE POLICY "Members insert progress via token" ON public.lesson_progress
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_progress.member_access_id
    AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
  )
  OR owns_lesson(auth.uid(), lesson_id)
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Members update progress via token" ON public.lesson_progress;
CREATE POLICY "Members update progress via token" ON public.lesson_progress
FOR UPDATE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_progress.member_access_id
    AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
  )
  OR owns_lesson(auth.uid(), lesson_id)
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Read own progress via token" ON public.lesson_progress;
CREATE POLICY "Read own progress via token" ON public.lesson_progress
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_progress.member_access_id
    AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
  )
  OR owns_lesson(auth.uid(), lesson_id)
  OR is_super_admin(auth.uid())
);

-- ========== lesson_reviews ==========
DROP POLICY IF EXISTS "Admins manage reviews" ON public.lesson_reviews;
CREATE POLICY "Admins manage own reviews" ON public.lesson_reviews
FOR ALL TO authenticated
USING (owns_lesson(auth.uid(), lesson_id) OR is_super_admin(auth.uid()))
WITH CHECK (owns_lesson(auth.uid(), lesson_id) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Members insert own review" ON public.lesson_reviews;
CREATE POLICY "Members insert own review" ON public.lesson_reviews
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
    AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
  )
  OR owns_lesson(auth.uid(), lesson_id)
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Members update own review" ON public.lesson_reviews;
CREATE POLICY "Members update own review" ON public.lesson_reviews
FOR UPDATE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
    AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
  )
  OR owns_lesson(auth.uid(), lesson_id)
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Read approved reviews or own" ON public.lesson_reviews;
CREATE POLICY "Read approved reviews or own" ON public.lesson_reviews
FOR SELECT TO anon, authenticated
USING (
  approved = true
  OR EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
    AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
  )
  OR owns_lesson(auth.uid(), lesson_id)
  OR is_super_admin(auth.uid())
);

-- ========== member_access ==========
DROP POLICY IF EXISTS "Admins can manage access" ON public.member_access;
CREATE POLICY "Admins can manage own access" ON public.member_access
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = member_access.course_id AND c.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = member_access.course_id AND c.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Access by token only" ON public.member_access;
CREATE POLICY "Access by token only" ON public.member_access
FOR SELECT TO anon, authenticated
USING (
  (access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = member_access.course_id AND c.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
);

-- ========== products: restrict public read to anon only ==========
DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Anon read active products" ON public.products
FOR SELECT TO anon
USING (active = true);

-- Authenticated users: only own products OR active (needed for checkout when logged in)
CREATE POLICY "Authenticated read products" ON public.products
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()) OR active = true);

-- ========== courses: restrict to ownership ==========
DROP POLICY IF EXISTS "Public read courses" ON public.courses;
CREATE POLICY "Anon read courses" ON public.courses
FOR SELECT TO anon
USING (true);

-- ========== checkout_settings: restrict to ownership ==========
DROP POLICY IF EXISTS "Public read checkout settings" ON public.checkout_settings;
CREATE POLICY "Anon read checkout settings" ON public.checkout_settings
FOR SELECT TO anon
USING (true);

CREATE POLICY "Authenticated read checkout settings" ON public.checkout_settings
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- ========== checkout_builder_configs ==========
DROP POLICY IF EXISTS "Public read configs" ON public.checkout_builder_configs;
CREATE POLICY "Anon read configs" ON public.checkout_builder_configs
FOR SELECT TO anon
USING (true);

CREATE POLICY "Authenticated read own configs" ON public.checkout_builder_configs
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));
