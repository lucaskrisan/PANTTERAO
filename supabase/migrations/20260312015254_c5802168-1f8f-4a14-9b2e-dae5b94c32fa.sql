-- Fix: Public read configs policy is RESTRICTIVE (cannot grant access alone)
-- Drop the restrictive policy and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Public read configs" ON public.checkout_builder_configs;
CREATE POLICY "Public read configs"
  ON public.checkout_builder_configs
  FOR SELECT
  TO public
  USING (true);