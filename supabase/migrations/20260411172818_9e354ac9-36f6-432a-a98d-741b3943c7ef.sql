ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS checkout_step text DEFAULT 'opened',
  ADD COLUMN IF NOT EXISTS ip_address text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_agent text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checkout_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_recovery_sent_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_recovery_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS product_price numeric DEFAULT NULL;