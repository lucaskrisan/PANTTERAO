
CREATE TABLE IF NOT EXISTS public.bin_cache (
  bin TEXT PRIMARY KEY,
  scheme TEXT,
  brand TEXT,
  bank_name TEXT,
  country_alpha2 TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bin_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bin_cache_public_read"
  ON public.bin_cache
  FOR SELECT
  USING (true);
