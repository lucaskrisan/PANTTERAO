-- 1. Remove anon SELECT on payment_gateways (config has API keys)
DROP POLICY IF EXISTS "Anon read active gateways for checkout" ON public.payment_gateways;

-- 2. Remove anon SELECT on product_pixels (capi_token exposed)  
DROP POLICY IF EXISTS "Anon read product pixels for checkout" ON public.product_pixels;