
-- Remove the overly permissive "Authenticated read products" policy
DROP POLICY IF EXISTS "Authenticated read products" ON public.products;

-- The existing "Producers read own products" policy already covers owner + super_admin reads.
-- The existing "Anon read active products" policy covers checkout public reads.
-- No new policy needed — authenticated users who are not the owner will use anon-level access via checkout flows.
