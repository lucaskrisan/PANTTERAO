CREATE TABLE IF NOT EXISTS public.billing_recharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  external_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
ALTER TABLE public.billing_recharges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own recharges" ON public.billing_recharges
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages recharges" ON public.billing_recharges
  FOR ALL TO service_role USING (true);
-- Atomic credit function
CREATE OR REPLACE FUNCTION public.add_billing_credit(
  p_user_id uuid,
  p_amount numeric,
  p_description text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
