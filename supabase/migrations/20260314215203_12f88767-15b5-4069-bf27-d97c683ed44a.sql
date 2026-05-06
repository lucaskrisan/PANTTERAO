CREATE OR REPLACE FUNCTION public.accrue_platform_fee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _fee numeric;
  _account billing_accounts%ROWTYPE;
  _monthly_sales numeric;
  _free_threshold numeric := 1000;
  _fee_percent numeric;
BEGIN
  IF NEW.status NOT IN ('paid', 'approved') THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status IN ('paid', 'approved') THEN
    RETURN NEW;
  END IF;

  _fee_percent := COALESCE(NEW.platform_fee_percent, 0);
  IF _fee_percent <= 0 THEN
    RETURN NEW;
  END IF;

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

  IF _fee <= 0 THEN
    NEW.platform_fee_amount := 0;
    RETURN NEW;
  END IF;

  NEW.platform_fee_amount := ROUND(_fee, 2);

  INSERT INTO public.billing_accounts (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.billing_accounts
  SET balance = balance + ROUND(_fee, 2), updated_at = now()
  WHERE user_id = NEW.user_id
  RETURNING * INTO _account;

  INSERT INTO public.billing_transactions (user_id, type, amount, description, order_id)
  VALUES (NEW.user_id, 'fee', ROUND(_fee, 2), 'Taxa de plataforma - Pedido ' || NEW.id::text, NEW.id);

  IF _account.balance > _account.credit_limit THEN
    UPDATE public.billing_accounts
    SET blocked = true, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$