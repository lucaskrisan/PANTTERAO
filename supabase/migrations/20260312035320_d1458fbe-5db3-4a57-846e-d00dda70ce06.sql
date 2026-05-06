
-- Fix lesson_progress INSERT/UPDATE policies to require token
DROP POLICY IF EXISTS "Members can insert progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Members can update progress" ON public.lesson_progress;

CREATE POLICY "Members insert progress via token"
ON public.lesson_progress
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.member_access ma
    WHERE ma.id = lesson_progress.member_access_id
    AND ma.access_token::text = coalesce(current_setting('request.headers', true)::json->>'x-access-token', '')
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Members update progress via token"
ON public.lesson_progress
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.member_access ma
    WHERE ma.id = lesson_progress.member_access_id
    AND ma.access_token::text = coalesce(current_setting('request.headers', true)::json->>'x-access-token', '')
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'))
);
