
CREATE OR REPLACE FUNCTION public.producer_has_gateway(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payment_gateways
    WHERE user_id = p_user_id AND active = true
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'super_admin'
  )
$$;
