
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'appsell';

-- Add constraint to validate delivery_method values
ALTER TABLE public.products
  ADD CONSTRAINT products_delivery_method_check
  CHECK (delivery_method IN ('panttera', 'appsell', 'email'));
