
-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Users can update own billing account" ON public.billing_accounts;
DROP POLICY IF EXISTS "Users update own billing_accounts" ON public.billing_accounts;

-- Find and drop any UPDATE policy on billing_accounts
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'billing_accounts' AND schemaname = 'public' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.billing_accounts', pol.policyname);
  END LOOP;
END;
$$;

-- Create restrictive UPDATE policy: users can ONLY change auto-recharge settings
CREATE POLICY "Users can update own auto-recharge settings"
ON public.billing_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  -- Ensure financial fields are NOT changed by checking they remain the same
);

-- Create a trigger to prevent users from changing financial fields
CREATE OR REPLACE FUNCTION public.protect_billing_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  -- If called by service_role, allow everything
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular users, prevent changes to financial fields
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    RAISE EXCEPTION 'Não é permitido alterar o saldo diretamente';
  END IF;
  IF NEW.credit_limit IS DISTINCT FROM OLD.credit_limit THEN
    RAISE EXCEPTION 'Não é permitido alterar o limite de crédito';
  END IF;
  IF NEW.credit_tier IS DISTINCT FROM OLD.credit_tier THEN
    RAISE EXCEPTION 'Não é permitido alterar o nível de crédito';
  END IF;
  IF NEW.blocked IS DISTINCT FROM OLD.blocked THEN
    RAISE EXCEPTION 'Não é permitido alterar o status de bloqueio';
  END IF;
  IF NEW.card_token IS DISTINCT FROM OLD.card_token THEN
    RAISE EXCEPTION 'Não é permitido alterar o token do cartão diretamente';
  END IF;
  IF NEW.card_last4 IS DISTINCT FROM OLD.card_last4 THEN
    RAISE EXCEPTION 'Não é permitido alterar dados do cartão diretamente';
  END IF;
  IF NEW.card_brand IS DISTINCT FROM OLD.card_brand THEN
    RAISE EXCEPTION 'Não é permitido alterar dados do cartão diretamente';
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS protect_billing_fields ON public.billing_accounts;
CREATE TRIGGER protect_billing_fields
  BEFORE UPDATE ON public.billing_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_billing_financial_fields();
