
CREATE OR REPLACE FUNCTION public.accrue_platform_fee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _fee numeric := 0.99;
  _account billing_accounts%ROWTYPE;
  _is_super boolean;
  _paid_count integer;
  _new_tier text;
BEGIN
  -- Only charge on transition to paid/approved
  IF NEW.status NOT IN ('paid', 'approved') THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.status IN ('paid', 'approved') THEN RETURN NEW; END IF;

  -- Super admins are exempt
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'super_admin'
  ) INTO _is_super;
  IF _is_super THEN
    NEW.platform_fee_amount := 0;
    RETURN NEW;
  END IF;

  -- Fixed fee: R$ 0,99 per sale
  NEW.platform_fee_amount := _fee;

  -- Ensure billing account exists
  INSERT INTO public.billing_accounts (user_id, balance)
  VALUES (NEW.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Debit fee from balance
  UPDATE public.billing_accounts
  SET balance = balance - _fee, updated_at = now()
  WHERE user_id = NEW.user_id
  RETURNING * INTO _account;

  -- Record transaction
  INSERT INTO public.billing_transactions (user_id, type, amount, description, order_id)
  VALUES (
    NEW.user_id, 'fee', _fee,
    'Taxa fixa R$0,99 — Venda R$' || ROUND(NEW.amount, 2)::text || ' — Pedido ' || NEW.id::text,
    NEW.id
  );

  -- Block if negative balance
  IF _account.balance < 0 THEN
    UPDATE public.billing_accounts
    SET blocked = true, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  -- Credit tier progression (unchanged)
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
$function$;
