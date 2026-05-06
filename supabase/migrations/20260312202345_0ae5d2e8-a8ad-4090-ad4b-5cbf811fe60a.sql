ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS utm_content text;
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS utm_term text;