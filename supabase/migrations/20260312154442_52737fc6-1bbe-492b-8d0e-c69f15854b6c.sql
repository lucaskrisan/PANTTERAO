
-- Lesson materials (complementary content per lesson)
CREATE TABLE public.lesson_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  material_type TEXT NOT NULL DEFAULT 'file',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;

-- Admins manage materials
CREATE POLICY "Admins manage lesson materials"
ON public.lesson_materials FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Members read materials via token (same pattern as lessons)
CREATE POLICY "Members read materials via access"
ON public.lesson_materials FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    JOIN course_modules cm ON cm.course_id = ma.course_id
    JOIN course_lessons cl ON cl.module_id = cm.id
    WHERE cl.id = lesson_materials.lesson_id
    AND ma.access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
    AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

-- Lesson reviews (comments + star ratings with approval)
CREATE TABLE public.lesson_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  member_access_id UUID NOT NULL REFERENCES public.member_access(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, member_access_id)
);

ALTER TABLE public.lesson_reviews ENABLE ROW LEVEL SECURITY;

-- Admins manage all reviews
CREATE POLICY "Admins manage reviews"
ON public.lesson_reviews FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Members can insert their own review via token
CREATE POLICY "Members insert own review"
ON public.lesson_reviews FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
    AND ma.access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

-- Members can update their own review via token
CREATE POLICY "Members update own review"
ON public.lesson_reviews FOR UPDATE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
    AND ma.access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

-- Anyone can read approved reviews; owner can read own
CREATE POLICY "Read approved reviews or own"
ON public.lesson_reviews FOR SELECT TO anon, authenticated
USING (
  approved = true
  OR EXISTS (
    SELECT 1 FROM member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
    AND ma.access_token::text = COALESCE((current_setting('request.headers', true)::json->>'x-access-token'), '')
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);
