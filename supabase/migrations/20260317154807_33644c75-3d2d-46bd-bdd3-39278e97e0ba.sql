
-- Allow any member with a valid course access token to read APPROVED reviews on lessons in that course
CREATE POLICY "Members read approved reviews in course"
ON public.lesson_reviews
FOR SELECT
USING (
  approved = true
  AND EXISTS (
    SELECT 1
    FROM member_access ma
    JOIN course_modules cm ON cm.course_id = ma.course_id
    JOIN course_lessons cl ON cl.module_id = cm.id
    WHERE cl.id = lesson_reviews.lesson_id
      AND (ma.access_token)::text = COALESCE(
        ((current_setting('request.headers'::text, true))::json ->> 'x-access-token'::text), ''::text
      )
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
  )
);
