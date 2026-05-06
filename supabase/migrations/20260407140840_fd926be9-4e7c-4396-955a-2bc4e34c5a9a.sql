
-- ===== 1. Fee exemption: skip R$0.99 until producer reaches R$1.00 in total revenue =====

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
  _supabase_url text;
  _service_role_key text;
  _total_revenue numeric;
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

  -- Free first R$1.00: check total approved revenue BEFORE this order
  SELECT COALESCE(SUM(amount), 0) INTO _total_revenue
  FROM public.orders
  WHERE user_id = NEW.user_id
    AND status IN ('paid', 'approved')
    AND id != NEW.id;

  IF _total_revenue < 1.00 THEN
    -- First sale(s) up to R$1.00 are fee-free
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

  -- Auto-recharge: if enabled and balance below threshold, trigger async recharge
  IF _account.auto_recharge_enabled
     AND _account.card_token IS NOT NULL
     AND _account.balance <= _account.auto_recharge_threshold
     AND (_account.last_auto_recharge_at IS NULL
          OR _account.last_auto_recharge_at < now() - interval '5 minutes')
  THEN
    BEGIN
      _supabase_url := current_setting('app.settings.supabase_url', true);
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

  -- Credit tier progression
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


-- ===== 2. Producer Verification (KYC) =====

CREATE TABLE public.producer_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL DEFAULT 'rg',
  document_front_url text,
  document_back_url text,
  selfie_url text,
  address_proof_url text,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.producer_verifications ENABLE ROW LEVEL SECURITY;

-- Producers can view their own verifications
CREATE POLICY "Producers view own verifications"
  ON public.producer_verifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Producers can insert their own verification
CREATE POLICY "Producers insert own verification"
  ON public.producer_verifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Super admins can manage all verifications
CREATE POLICY "Super admins manage verifications"
  ON public.producer_verifications FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Add verified flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- Storage bucket for verification documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users upload own verification docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'verification-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users view own verification docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'verification-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_super_admin(auth.uid())));

CREATE POLICY "Super admins view all verification docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'verification-documents' AND is_super_admin(auth.uid()));
