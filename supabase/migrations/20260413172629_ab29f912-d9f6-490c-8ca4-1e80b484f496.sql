CREATE OR REPLACE FUNCTION public.update_abandoned_cart(
  p_cart_id uuid,
  p_customer_name text DEFAULT NULL,
  p_customer_email text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_cpf text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_checkout_step text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.abandoned_carts
  SET
    customer_name = COALESCE(p_customer_name, customer_name),
    customer_email = COALESCE(p_customer_email, customer_email),
    customer_phone = COALESCE(p_customer_phone, customer_phone),
    customer_cpf = COALESCE(p_customer_cpf, customer_cpf),
    payment_method = COALESCE(p_payment_method, payment_method),
    checkout_step = COALESCE(p_checkout_step, checkout_step),
    updated_at = now()
  WHERE id = p_cart_id
    AND created_at > now() - interval '2 hours';

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count > 0;
END;
$$;