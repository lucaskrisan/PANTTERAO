-- Fix 1: Course materials storage - verify course ownership on upload
DROP POLICY IF EXISTS "Admins upload course materials" ON storage.objects;

CREATE POLICY "Admins upload course materials" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.user_id = auth.uid()
        AND name LIKE (c.id::text || '/%')
    )
  )
);

-- Also fix UPDATE and DELETE to verify ownership
DROP POLICY IF EXISTS "Admins update course materials" ON storage.objects;

CREATE POLICY "Admins update course materials" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.user_id = auth.uid()
        AND name LIKE (c.id::text || '/%')
    )
  )
);

DROP POLICY IF EXISTS "Admins delete course materials" ON storage.objects;

CREATE POLICY "Admins delete course materials" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.user_id = auth.uid()
        AND name LIKE (c.id::text || '/%')
    )
  )
);

-- Fix 2: PWA settings - create public view without user_id
CREATE OR REPLACE VIEW public.public_pwa_settings
WITH (security_invoker = false)
AS
SELECT
  id, app_name, short_name, description,
  theme_color, background_color,
  icon_192_url, icon_512_url, splash_image_url,
  notification_title, notification_body, notification_icon_url,
  updated_at
FROM public.pwa_settings;

-- Grant access to the view
GRANT SELECT ON public.public_pwa_settings TO anon, authenticated;