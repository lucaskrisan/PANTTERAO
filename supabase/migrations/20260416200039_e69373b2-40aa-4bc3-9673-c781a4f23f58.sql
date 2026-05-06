ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_city text,
  ADD COLUMN IF NOT EXISTS customer_zip text,
  ADD COLUMN IF NOT EXISTS customer_country text;

ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS customer_city text,
  ADD COLUMN IF NOT EXISTS customer_zip text,
  ADD COLUMN IF NOT EXISTS customer_country text;