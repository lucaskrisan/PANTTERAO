
-- Drop the existing ALL policy that allows any authenticated owner to do everything
-- We need to split it into SELECT/UPDATE/DELETE (keep as-is) and a restricted INSERT

-- First, create a helper function to check verification status
CREATE OR REPLACE FUNCTION public.is_verified_producer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.producer_verifications
    WHERE user_id = _user_id AND status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND verified = true
  )
$$;

-- Now update the products INSERT policy to require verification
-- First drop the existing ALL policy
DROP POLICY IF EXISTS "Producers manage own products" ON public.products;

-- Re-create granular policies
-- SELECT: owner or super_admin (unchanged behavior)
CREATE POLICY "Producers read own products"
ON public.products
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- INSERT: only verified producers or super_admin
CREATE POLICY "Verified producers create products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (is_super_admin(auth.uid()) OR is_verified_producer(auth.uid()))
);

-- UPDATE: owner or super_admin (unchanged behavior)
CREATE POLICY "Producers update own products"
ON public.products
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- DELETE: owner or super_admin (unchanged behavior)
CREATE POLICY "Producers delete own products"
ON public.products
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));
