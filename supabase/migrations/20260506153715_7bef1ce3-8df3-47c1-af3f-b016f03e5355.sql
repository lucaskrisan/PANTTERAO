ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS collaborator_id uuid REFERENCES auth.users(id);

-- Policy to allow collaborators to see their assigned orders
CREATE POLICY "Collaborators can see orders attributed to them"
ON public.orders FOR SELECT
USING (collaborator_id = auth.uid());
