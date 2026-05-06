
-- Fix public_product_pixels view to use security_invoker
DROP VIEW IF EXISTS public.public_product_pixels;
CREATE VIEW public.public_product_pixels WITH (security_invoker = true) AS
SELECT id, pixel_id, platform, product_id, domain, fire_on_boleto, fire_on_pix
FROM public.product_pixels;
