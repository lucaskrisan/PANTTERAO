-- Update products RLS for collaborators
DROP POLICY IF EXISTS "Collaborators can view all active products" ON public.products;

CREATE POLICY "Collaborators can view products for reference"
  ON public.products FOR SELECT
  USING (
    has_role(auth.uid(), 'collaborator')
  );
