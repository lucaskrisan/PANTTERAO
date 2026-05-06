CREATE OR REPLACE FUNCTION public.add_billing_credit(p_user_id uuid, p_amount numeric, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.billing_accounts (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET
    balance = billing_accounts.balance + p_amount,
    blocked = false,
    updated_at = now();

  INSERT INTO public.billing_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'credit', p_amount, p_description);
END;
$$;