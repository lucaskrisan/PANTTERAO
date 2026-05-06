
-- 1. Fix active_gateways view: make it security invoker so RLS from payment_gateways applies
DROP VIEW IF EXISTS public.active_gateways;
CREATE VIEW public.active_gateways
WITH (security_invoker = true)
AS
SELECT id, provider, environment, name, payment_methods, user_id
FROM public.payment_gateways
WHERE active = true;

-- 2. Fix lesson_progress: restrict reads to own progress via access token
DROP POLICY IF EXISTS "Anyone can read progress" ON public.lesson_progress;

CREATE POLICY "Read own progress via token"
ON public.lesson_progress
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.member_access ma
    WHERE ma.id = lesson_progress.member_access_id
    AND ma.access_token::text = coalesce(current_setting('request.headers', true)::json->>'x-access-token', '')
  )
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'))
);
