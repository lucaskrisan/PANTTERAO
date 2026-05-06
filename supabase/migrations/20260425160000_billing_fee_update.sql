-- Update platform fee: R$0,99 fixed + 2% of sale amount
-- Free until producer reaches R$1,000 in cumulative approved revenue (all-time)
-- After R$1,000: every sale is charged. No disclosure to producer needed.
-- Super admin remains exempt.

CREATE OR REPLACE FUNCTION public.accrue_platform_fee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _fixed_fee        numeric := 0.99;
  _free_threshold   numeric := 1000.00;
  _pct_fee          numeric;
  _fee              numeric;
  _account          billing_accounts%ROWTYPE;
  _is_super         boolean;
  _paid_count       integer;
  _new_tier         text;
  _total_revenue    numeric;
  _supabase_url     text;
  _service_role_key text;
BEGIN
  -- Only fire on transition to paid/approved
  IF NEW.status NOT IN ('paid', 'approved') THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.status IN ('paid', 'approved') THEN RETURN NEW; END IF;

  -- Super admin is always exempt
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'super_admin'
  ) INTO _is_super;

  IF _is_super THEN
    NEW.platform_fee_amount := 0;
    RETURN NEW;
  END IF;

  -- Free period: first R$1,000 of cumulative all-time approved revenue
  SELECT COALESCE(SUM(amount), 0) INTO _total_revenue
  FROM public.orders
  WHERE user_id = NEW.user_id
    AND status IN ('paid', 'approved')
    AND id != NEW.id;

  IF (_total_revenue + NEW.amount) <= _free_threshold THEN
    NEW.platform_fee_amount := 0;
    RETURN NEW;
  END IF;

  -- Fee = R$0,99 fixo + 2% do valor da venda
  _pct_fee := ROUND((2.0 / 100.0) * NEW.amount, 2);
  _fee     := _fixed_fee + _pct_fee;
  _fee     := ROUND(_fee, 2);

  NEW.platform_fee_amount := _fee;

  -- Create billing account if not exists
  INSERT INTO public.billing_accounts (user_id, balance)
  VALUES (NEW.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Deduct fee from producer balance
  UPDATE public.billing_accounts
  SET balance = balance - _fee, updated_at = now()
  WHERE user_id = NEW.user_id
  RETURNING * INTO _account;

  -- Log the transaction
  INSERT INTO public.billing_transactions (user_id, type, amount, description, order_id)
  VALUES (
    NEW.user_id,
    'fee',
    _fee,
    'Taxa R$0,99 + 2% = R$' || ROUND(_fee, 2)::text
      || ' — Venda R$' || ROUND(NEW.amount, 2)::text
      || ' — Pedido ' || NEW.id::text,
    NEW.id
  );

  -- Block if balance goes negative
  IF _account.balance < 0 THEN
    UPDATE public.billing_accounts
    SET blocked = true, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  -- Auto-recharge if configured
  IF _account.auto_recharge_enabled
     AND _account.card_token IS NOT NULL
     AND _account.balance <= _account.auto_recharge_threshold
     AND (_account.last_auto_recharge_at IS NULL
          OR _account.last_auto_recharge_at < now() - interval '5 minutes')
  THEN
    BEGIN
      _supabase_url     := current_setting('app.settings.supabase_url', true);
      _service_role_key := current_setting('app.settings.service_role_key', true);
      IF _supabase_url IS NOT NULL AND _service_role_key IS NOT NULL THEN
        PERFORM extensions.http_post(
          _supabase_url || '/functions/v1/billing-auto-recharge',
          jsonb_build_object('user_id', NEW.user_id)::text,
          'application/json',
          ARRAY[
            extensions.http_header('Authorization', 'Bearer ' || _service_role_key),
            extensions.http_header('Content-Type', 'application/json')
          ]
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Auto-recharge call failed for user %: %', NEW.user_id, SQLERRM;
    END;
  END IF;

  -- Update gamification tier based on recharges in last 90 days
  SELECT COUNT(*) INTO _paid_count
  FROM public.billing_transactions
  WHERE user_id = NEW.user_id
    AND type = 'credit'
    AND created_at >= now() - interval '90 days';

  IF    _paid_count >= 20 THEN _new_tier := 'diamond';
  ELSIF _paid_count >= 15 THEN _new_tier := 'platinum';
  ELSIF _paid_count >= 10 THEN _new_tier := 'gold';
  ELSIF _paid_count >= 5  THEN _new_tier := 'silver';
  ELSIF _paid_count >= 2  THEN _new_tier := 'bronze';
  ELSE                         _new_tier := 'iron';
  END IF;

  UPDATE public.billing_accounts
  SET
    credit_tier  = _new_tier,
    credit_limit = (SELECT credit_limit FROM public.billing_tiers WHERE key = _new_tier),
    updated_at   = now()
  WHERE user_id = NEW.user_id
    AND credit_tier != _new_tier;

  RETURN NEW;
END;
$function$;
