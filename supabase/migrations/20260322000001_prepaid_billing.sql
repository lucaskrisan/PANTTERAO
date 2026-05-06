-- Drop old trigger and function
DROP TRIGGER IF EXISTS trg_accrue_platform_fee ON public.orders;
DROP FUNCTION IF EXISTS public.accrue_platform_fee();
-- Pre-paid model: deduct fee FROM producer balance
CREATE OR REPLACE FUNCTION public.accrue_platform_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _fee numeric;
  _account billing_accounts%ROWTYPE;
  _fee_percent numeric;
  _is_super boolean;
  _free_threshold numeric := 1000;
  _monthly_sales numeric;
  _paid_count integer;
  _new_tier text;
BEGIN
  IF NEW.status NOT IN ('paid', 'approved') THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.status IN ('paid', 'approved') THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'super_admin'
  ) INTO _is_super;
  IF _is_super THEN
    NEW.platform_fee_amount := 0;
    RETURN NEW;
  END IF;
  _fee_percent := COALESCE(NEW.platform_fee_percent, 3);
  IF _fee_percent <= 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM(amount), 0) INTO _monthly_sales
  FROM public.orders
  WHERE user_id = NEW.user_id
    AND status IN ('paid', 'approved')
    AND created_at >= date_trunc('month', now())
    AND id != NEW.id;
  IF (_monthly_sales + NEW.amount) <= _free_threshold THEN
    NEW.platform_fee_amount := 0;
    RETURN NEW;
  END IF;
  IF _monthly_sales < _free_threshold THEN
    _fee := (_fee_percent / 100.0) * ((_monthly_sales + NEW.amount) - _free_threshold);
  ELSE
    _fee := (_fee_percent / 100.0) * NEW.amount;
  END IF;
  _fee := ROUND(_fee, 2);
  IF _fee <= 0 THEN
    NEW.platform_fee_amount := 0;
    RETURN NEW;
  END IF;
  NEW.platform_fee_amount := _fee;
  INSERT INTO public.billing_accounts (user_id, balance)
  VALUES (NEW.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  -- Deduct fee from balance (pre-paid)
  UPDATE public.billing_accounts
  SET balance = balance - _fee, updated_at = now()
  WHERE user_id = NEW.user_id
  RETURNING * INTO _account;
  INSERT INTO public.billing_transactions (user_id, type, amount, description, order_id)
  VALUES (
    NEW.user_id, 'fee', _fee,
    'Taxa 3% — Venda R$' || ROUND(NEW.amount, 2)::text || ' — Pedido ' || NEW.id::text,
    NEW.id
  );
  -- Block if balance goes negative
  IF _account.balance < 0 THEN
    UPDATE public.billing_accounts
    SET blocked = true, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  -- Auto-upgrade tier (gamification) based on credit deposits in last 90 days
  SELECT COUNT(*) INTO _paid_count
  FROM public.billing_transactions
  WHERE user_id = NEW.user_id
    AND type = 'credit'
    AND created_at >= now() - interval '90 days';
  IF _paid_count >= 20 THEN _new_tier := 'diamond';
  ELSIF _paid_count >= 15 THEN _new_tier := 'platinum';
  ELSIF _paid_count >= 10 THEN _new_tier := 'gold';
  ELSIF _paid_count >= 5 THEN _new_tier := 'silver';
  ELSIF _paid_count >= 2 THEN _new_tier := 'bronze';
  ELSE _new_tier := 'iron';
  END IF;
  UPDATE public.billing_accounts
  SET
    credit_tier = _new_tier,
    credit_limit = (SELECT credit_limit FROM public.billing_tiers WHERE key = _new_tier),
    updated_at = now()
  WHERE user_id = NEW.user_id
    AND credit_tier != _new_tier;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_accrue_platform_fee
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.accrue_platform_fee();
UPDATE public.platform_settings SET platform_fee_percent = 3;
