-- Add Stripe Payment Method Domain tracking to custom_domains
ALTER TABLE public.custom_domains
  ADD COLUMN IF NOT EXISTS stripe_pmd_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_apple_pay_status text DEFAULT NULL;

-- Mark existing active domains as pending registration
UPDATE public.custom_domains
  SET stripe_apple_pay_status = 'pending'
  WHERE status = 'active' AND stripe_apple_pay_status IS NULL;

-- Trigger: when a domain becomes active, mark it for Stripe registration.
-- The actual HTTP call to stripe-register-domain is made by cloudflare-check-status
-- (application layer) so this trigger only sets the pending marker as a safety net.
CREATE OR REPLACE FUNCTION public.mark_domain_stripe_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    NEW.stripe_apple_pay_status := COALESCE(NEW.stripe_apple_pay_status, 'pending');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_domain_active_mark_stripe ON public.custom_domains;
CREATE TRIGGER on_domain_active_mark_stripe
  BEFORE UPDATE ON public.custom_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_domain_stripe_pending();
