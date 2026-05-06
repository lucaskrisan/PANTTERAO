
-- Billing accounts: one per producer (user)
CREATE TABLE public.billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  credit_tier text NOT NULL DEFAULT 'iron',
  credit_limit numeric NOT NULL DEFAULT 5,
  blocked boolean NOT NULL DEFAULT false,
  card_last4 text,
  card_brand text,
  card_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Billing transactions: fee accruals and payments
CREATE TABLE public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'fee',
  amount numeric NOT NULL DEFAULT 0,
  description text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: producers see own billing account
CREATE POLICY "Users manage own billing account"
  ON public.billing_accounts FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- RLS: producers see own transactions
CREATE POLICY "Users manage own billing transactions"
  ON public.billing_transactions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Function to accrue platform fee when order is paid
CREATE OR REPLACE FUNCTION public.accrue_platform_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _fee numeric;
  _account billing_accounts%ROWTYPE;
BEGIN
  -- Only trigger on status change to paid/approved
  IF NEW.status NOT IN ('paid', 'approved') THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status IN ('paid', 'approved') THEN
    RETURN NEW;
  END IF;

  _fee := COALESCE(NEW.platform_fee_amount, 0);
  IF _fee <= 0 THEN
    RETURN NEW;
  END IF;

  -- Ensure billing account exists
  INSERT INTO public.billing_accounts (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Add fee to balance (balance = amount owed)
  UPDATE public.billing_accounts
  SET balance = balance + _fee, updated_at = now()
  WHERE user_id = NEW.user_id
  RETURNING * INTO _account;

  -- Record transaction
  INSERT INTO public.billing_transactions (user_id, type, amount, description, order_id)
  VALUES (NEW.user_id, 'fee', _fee, 'Taxa de plataforma - Pedido ' || NEW.id::text, NEW.id);

  -- Check if over limit → block
  IF _account.balance > _account.credit_limit THEN
    UPDATE public.billing_accounts
    SET blocked = true, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on orders
CREATE TRIGGER trg_accrue_platform_fee
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.accrue_platform_fee();
