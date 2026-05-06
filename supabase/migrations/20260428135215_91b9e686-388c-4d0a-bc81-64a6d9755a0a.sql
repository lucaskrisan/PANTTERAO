ALTER TABLE public.checkout_builder_configs 
ADD COLUMN IF NOT EXISTS is_split_active boolean DEFAULT false;