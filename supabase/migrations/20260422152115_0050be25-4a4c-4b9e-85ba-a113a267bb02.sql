DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update safe profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND verified = (SELECT p.verified FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.is_verified_producer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.producer_verifications
    WHERE user_id = _user_id AND status = 'approved'
  )
$function$;