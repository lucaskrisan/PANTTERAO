
-- 1) CRITICAL: Remove the public read policy that exposes ALL course materials
DROP POLICY IF EXISTS "Public read course materials" ON storage.objects;

-- 2) Replace the old cross-course "Members read" policy with a course-scoped version
DROP POLICY IF EXISTS "Members read course materials" ON storage.objects;
DROP POLICY IF EXISTS "Members read course materials scoped" ON storage.objects;

CREATE POLICY "Members read course materials scoped"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'course-materials'
  AND (
    -- Course-scoped token access: file path must start with the enrolled course_id
    EXISTS (
      SELECT 1 FROM public.member_access ma
      WHERE ma.access_token::text = COALESCE(
        (current_setting('request.headers', true)::json->>'x-access-token'), ''
      )
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
      AND storage.objects.name LIKE (ma.course_id::text || '/%')
    )
    -- Admin/producer access
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
    )
  )
);

-- 3) Fix internal_tasks: allow producers to manage their own tasks
CREATE POLICY "Producers manage own internal tasks"
ON public.internal_tasks FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
