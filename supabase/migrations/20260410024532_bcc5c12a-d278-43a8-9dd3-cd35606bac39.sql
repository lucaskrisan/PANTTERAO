
-- Drop the insecure public UPDATE policy
DROP POLICY IF EXISTS "Public update own abandoned cart" ON public.abandoned_carts;

-- Create a secure RPC to update abandoned carts by ID
-- Only allows update if the cart was created in the last 2 hours
CREATE OR REPLACE FUNCTION public.update_abandoned_cart(
  p_cart_id uuid,
  p_customer_name text DEFAULT NULL,
  p_customer_email text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_cpf text DEFAULT NULL,
  p_payment_method text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated boolean;
BEGIN
  UPDATE public.abandoned_carts
  SET
    customer_name = COALESCE(p_customer_name, customer_name),
    customer_email = COALESCE(p_customer_email, customer_email),
    customer_phone = COALESCE(p_customer_phone, customer_phone),
    customer_cpf = COALESCE(p_customer_cpf, customer_cpf),
    payment_method = COALESCE(p_payment_method, payment_method),
    updated_at = now()
  WHERE id = p_cart_id
    AND created_at > now() - interval '2 hours';

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;
