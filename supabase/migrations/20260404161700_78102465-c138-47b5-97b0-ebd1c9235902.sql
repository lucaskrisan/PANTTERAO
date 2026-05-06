ALTER TABLE public.checkout_settings
  DROP COLUMN IF EXISTS crisp_website_id,
  DROP COLUMN IF EXISTS crisp_enabled_checkout,
  DROP COLUMN IF EXISTS crisp_enabled_landing;