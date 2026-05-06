
-- Table for replies to reviews (both AI and student replies)
CREATE TABLE public.review_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.lesson_reviews(id) ON DELETE CASCADE,
  member_access_id UUID REFERENCES public.member_access(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  is_ai_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for likes on reviews
CREATE TABLE public.review_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.lesson_reviews(id) ON DELETE CASCADE,
  member_access_id UUID NOT NULL REFERENCES public.member_access(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(review_id, member_access_id)
);

-- Add ai_reply_enabled column to courses for producer toggle
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS ai_reply_enabled BOOLEAN NOT NULL DEFAULT true;

-- Enable RLS
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

-- RLS for review_replies: members can read replies on approved reviews they can see
CREATE POLICY "Members read replies via access token"
  ON public.review_replies FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_reviews lr
      JOIN public.course_lessons cl ON cl.id = lr.lesson_id
      JOIN public.course_modules cm ON cm.id = cl.module_id
      JOIN public.member_access ma ON ma.course_id = cm.course_id
      WHERE lr.id = review_replies.review_id
        AND lr.approved = true
        AND (ma.access_token)::text = COALESCE((current_setting('request.headers', true)::json ->> 'x-access-token'), '')
        AND (ma.expires_at IS NULL OR ma.expires_at > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.lesson_reviews lr
      WHERE lr.id = review_replies.review_id
        AND owns_lesson(auth.uid(), lr.lesson_id)
    )
    OR is_super_admin(auth.uid())
  );

-- Members insert replies via access token
CREATE POLICY "Members insert replies via token"
  ON public.review_replies FOR INSERT TO public
  WITH CHECK (
    member_access_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.member_access ma
      WHERE ma.id = review_replies.member_access_id
        AND (ma.access_token)::text = COALESCE((current_setting('request.headers', true)::json ->> 'x-access-token'), '')
        AND (ma.expires_at IS NULL OR ma.expires_at > now())
    )
  );

-- Service role can insert AI replies
CREATE POLICY "Service role manages replies"
  ON public.review_replies FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Admins manage replies on own lessons
CREATE POLICY "Admins manage own replies"
  ON public.review_replies FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_reviews lr
      WHERE lr.id = review_replies.review_id
        AND (owns_lesson(auth.uid(), lr.lesson_id) OR is_super_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lesson_reviews lr
      WHERE lr.id = review_replies.review_id
        AND (owns_lesson(auth.uid(), lr.lesson_id) OR is_super_admin(auth.uid()))
    )
  );

-- RLS for review_likes
CREATE POLICY "Members read likes via token"
  ON public.review_likes FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_reviews lr
      JOIN public.course_lessons cl ON cl.id = lr.lesson_id
      JOIN public.course_modules cm ON cm.id = cl.module_id
      JOIN public.member_access ma ON ma.course_id = cm.course_id
      WHERE lr.id = review_likes.review_id
        AND lr.approved = true
        AND (ma.access_token)::text = COALESCE((current_setting('request.headers', true)::json ->> 'x-access-token'), '')
        AND (ma.expires_at IS NULL OR ma.expires_at > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.lesson_reviews lr
      WHERE lr.id = review_likes.review_id
        AND owns_lesson(auth.uid(), lr.lesson_id)
    )
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Members toggle likes via token"
  ON public.review_likes FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.member_access ma
      WHERE ma.id = review_likes.member_access_id
        AND (ma.access_token)::text = COALESCE((current_setting('request.headers', true)::json ->> 'x-access-token'), '')
        AND (ma.expires_at IS NULL OR ma.expires_at > now())
    )
  );

CREATE POLICY "Members delete own likes via token"
  ON public.review_likes FOR DELETE TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.member_access ma
      WHERE ma.id = review_likes.member_access_id
        AND (ma.access_token)::text = COALESCE((current_setting('request.headers', true)::json ->> 'x-access-token'), '')
        AND (ma.expires_at IS NULL OR ma.expires_at > now())
    )
  );

CREATE POLICY "Admins manage likes on own lessons"
  ON public.review_likes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_reviews lr
      WHERE lr.id = review_likes.review_id
        AND (owns_lesson(auth.uid(), lr.lesson_id) OR is_super_admin(auth.uid()))
    )
  );
