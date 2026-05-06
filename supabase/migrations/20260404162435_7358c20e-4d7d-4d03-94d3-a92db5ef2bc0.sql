-- Fix: Change view to security_invoker = true
DROP VIEW IF EXISTS public.public_pwa_settings;

CREATE OR REPLACE VIEW public.public_pwa_settings
WITH (security_invoker = true)
AS
SELECT
  id, app_name, short_name, description,
  theme_color, background_color,
  icon_192_url, icon_512_url, splash_image_url,
  notification_title, notification_body, notification_icon_url,
  updated_at
FROM public.pwa_settings;

GRANT SELECT ON public.public_pwa_settings TO anon, authenticated;