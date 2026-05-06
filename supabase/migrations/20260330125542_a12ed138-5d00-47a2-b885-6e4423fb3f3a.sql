
ALTER TABLE public.checkout_settings
  ADD COLUMN IF NOT EXISTS crisp_enabled_checkout BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS crisp_enabled_landing BOOLEAN NOT NULL DEFAULT true;
