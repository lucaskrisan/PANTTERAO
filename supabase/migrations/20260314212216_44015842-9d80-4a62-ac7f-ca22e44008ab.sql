-- 1. Fix active_gateways view with security_invoker to enforce RLS
DROP VIEW IF EXISTS public.active_gateways;
CREATE VIEW public.active_gateways
WITH (security_invoker = on)
AS SELECT id, name, environment, payment_methods, user_id, provider
FROM public.payment_gateways
WHERE active = true;

-- 2. Fix public_product_pixels view with security_invoker
DROP VIEW IF EXISTS public.public_product_pixels;
CREATE VIEW public.public_product_pixels
WITH (security_invoker = on)
AS SELECT id, pixel_id, product_id, platform, domain, fire_on_pix, fire_on_boleto
FROM public.product_pixels;

-- 3. Add anon SELECT on product_pixels so the public view works for checkout
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read product pixels for checkout' AND tablename = 'product_pixels') THEN
    CREATE POLICY "Anon read product pixels for checkout"
    ON public.product_pixels FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;

-- 4. Add anon SELECT on payment_gateways so active_gateways view works for checkout
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read active gateways for checkout' AND tablename = 'payment_gateways') THEN
    CREATE POLICY "Anon read active gateways for checkout"
    ON public.payment_gateways FOR SELECT
    TO anon
    USING (active = true);
  END IF;
END $$;