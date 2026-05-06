-- SECURITY HOTFIX: lesson_reviews must never expose other customers' reviews in member panel

-- Remove permissive policies that allowed reading approved reviews globally
DROP POLICY IF EXISTS "Read approved reviews or own" ON public.lesson_reviews;
DROP POLICY IF EXISTS "Members insert own review" ON public.lesson_reviews;
DROP POLICY IF EXISTS "Members update own review" ON public.lesson_reviews;

-- Member can insert only for their own valid (non-expired) access token
CREATE POLICY "Members insert own review (active token)"
ON public.lesson_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
      AND ma.access_token::text = COALESCE((current_setting('request.headers', true))::json ->> 'x-access-token', '')
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
);

-- Member can update only their own review with active token
CREATE POLICY "Members update own review (active token)"
ON public.lesson_reviews
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
      AND ma.access_token::text = COALESCE((current_setting('request.headers', true))::json ->> 'x-access-token', '')
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
      AND ma.access_token::text = COALESCE((current_setting('request.headers', true))::json ->> 'x-access-token', '')
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
);

-- Member can read only their own review with active token
CREATE POLICY "Members read own review (active token)"
ON public.lesson_reviews
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.member_access ma
    WHERE ma.id = lesson_reviews.member_access_id
      AND ma.access_token::text = COALESCE((current_setting('request.headers', true))::json ->> 'x-access-token', '')
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
  OR owns_lesson(auth.uid(), lesson_id)
  OR is_super_admin(auth.uid())
);