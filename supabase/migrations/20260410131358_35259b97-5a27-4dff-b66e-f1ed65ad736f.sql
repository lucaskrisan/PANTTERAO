-- Step 1: Drop the existing permissive UPDATE policy on profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Step 2: Revoke UPDATE on the 'verified' column from authenticated and anon
-- This prevents any non-service_role user from modifying the verified flag
REVOKE UPDATE (verified) ON public.profiles FROM authenticated;
REVOKE UPDATE (verified) ON public.profiles FROM anon;

-- Step 3: Re-create the UPDATE policy (same as before, but now the column grant blocks verified)
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);