ALTER TABLE public.pixel_events
  ADD COLUMN IF NOT EXISTS customer_country TEXT,
  ADD COLUMN IF NOT EXISTS customer_city TEXT;

CREATE INDEX IF NOT EXISTS idx_pixel_events_customer_country
  ON public.pixel_events (customer_country)
  WHERE customer_country IS NOT NULL;