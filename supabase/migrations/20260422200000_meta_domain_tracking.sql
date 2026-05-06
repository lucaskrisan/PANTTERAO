-- Add meta_domain to products: custom domain for CAPI event_source_url
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_domain text DEFAULT '';

-- Add event_source_url to orders: captured at checkout time (origin + pathname)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS event_source_url text DEFAULT '';

-- Add event_source_url to abandoned_carts: same capture
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS event_source_url text DEFAULT '';
