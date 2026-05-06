-- Create public view excluding user_id
CREATE OR REPLACE VIEW public.public_order_bumps
WITH (security_invoker = true)
AS
SELECT
  id, product_id, bump_product_id, title, description,
  call_to_action, use_product_image, sort_order, active
FROM public.order_bumps
WHERE active = true;

GRANT SELECT ON public.public_order_bumps TO anon, authenticated;