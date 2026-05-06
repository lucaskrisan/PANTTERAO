
-- Fix: producers should NOT see all profiles, only super_admin should
DROP POLICY IF EXISTS "Admins and super admins can view all profiles" ON public.profiles;

CREATE POLICY "Super admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));
