ALTER TABLE public.products 
ADD COLUMN is_subscription boolean NOT NULL DEFAULT false,
ADD COLUMN billing_cycle text NOT NULL DEFAULT 'monthly';