ALTER TABLE public.ab_tests
  ADD COLUMN IF NOT EXISTS graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS entry_url text;