
-- Make insert policies slightly more restrictive by requiring non-empty data
DROP POLICY "Anyone can insert customers" ON public.customers;
CREATE POLICY "Anyone can insert customers" ON public.customers FOR INSERT WITH CHECK (name IS NOT NULL AND email IS NOT NULL);

DROP POLICY "Anyone can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (amount > 0 AND payment_method IS NOT NULL);
