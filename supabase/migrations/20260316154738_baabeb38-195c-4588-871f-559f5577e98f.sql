
-- 1. Fix lesson_progress INSERT policy: add expires_at validation
DROP POLICY IF EXISTS "Members insert progress via token" ON public.lesson_progress;
CREATE POLICY "Members insert progress via token" ON public.lesson_progress
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM member_access ma
      WHERE ma.id = lesson_progress.member_access_id
        AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
        AND (ma.expires_at IS NULL OR ma.expires_at > now())
    ))
    OR owns_lesson(auth.uid(), lesson_id)
    OR is_super_admin(auth.uid())
  );

-- 2. Fix lesson_progress UPDATE policy: add expires_at validation
DROP POLICY IF EXISTS "Members update progress via token" ON public.lesson_progress;
CREATE POLICY "Members update progress via token" ON public.lesson_progress
  FOR UPDATE TO anon, authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM member_access ma
      WHERE ma.id = lesson_progress.member_access_id
        AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
        AND (ma.expires_at IS NULL OR ma.expires_at > now())
    ))
    OR owns_lesson(auth.uid(), lesson_id)
    OR is_super_admin(auth.uid())
  );

-- 3. Make course-materials bucket private
UPDATE storage.buckets SET public = false WHERE id = 'course-materials';

-- 4. Storage policies for course-materials: allow read via valid token
DROP POLICY IF EXISTS "Members read course materials" ON storage.objects;
CREATE POLICY "Members read course materials" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'course-materials'
    AND (
      EXISTS (
        SELECT 1 FROM member_access ma
        WHERE (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
          AND (ma.expires_at IS NULL OR ma.expires_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
      )
    )
  );

-- 5. Storage policy: admins upload to course-materials
DROP POLICY IF EXISTS "Admins upload course materials" ON storage.objects;
CREATE POLICY "Admins upload course materials" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
    )
  );

-- 6. Storage policy: admins delete course materials
DROP POLICY IF EXISTS "Admins delete course materials" ON storage.objects;
CREATE POLICY "Admins delete course materials" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
    )
  );

-- 7. Allow customers to read own record via valid token
DROP POLICY IF EXISTS "Customers read own via token" ON public.customers;
CREATE POLICY "Customers read own via token" ON public.customers
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_access ma
      WHERE ma.customer_id = customers.id
        AND (ma.access_token)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text)
        AND (ma.expires_at IS NULL OR ma.expires_at > now())
    )
  );
