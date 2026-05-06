-- Add Stripe Payment Method Domain columns to custom_domains
ALTER TABLE public.custom_domains
  ADD COLUMN IF NOT EXISTS stripe_pmd_id text,
  ADD COLUMN IF NOT EXISTS stripe_apple_pay_status text DEFAULT 'pending';

-- Index for quick lookups by PMD id
CREATE INDEX IF NOT EXISTS idx_custom_domains_stripe_pmd_id
  ON public.custom_domains (stripe_pmd_id)
  WHERE stripe_pmd_id IS NOT NULL;