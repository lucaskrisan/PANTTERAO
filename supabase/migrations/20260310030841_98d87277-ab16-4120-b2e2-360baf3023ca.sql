-- Fix overly permissive INSERT/UPDATE on lesson_progress
-- Tighten to require valid member_access_id
DROP POLICY IF EXISTS "Anyone can insert progress" ON public.lesson_progress;
CREATE POLICY "Members can insert progress" ON public.lesson_progress FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.member_access WHERE id = member_access_id)
  );

DROP POLICY IF EXISTS "Anyone can update progress" ON public.lesson_progress;
CREATE POLICY "Members can update progress" ON public.lesson_progress FOR UPDATE TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.member_access WHERE id = member_access_id)
  );