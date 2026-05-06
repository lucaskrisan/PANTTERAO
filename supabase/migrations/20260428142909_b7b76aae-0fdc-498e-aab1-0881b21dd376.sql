ALTER TABLE public.checkout_builder_configs 
ADD COLUMN IF NOT EXISTS traffic_weight INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS test_started_at TIMESTAMP WITH TIME ZONE;

-- Add a comment for better documentation
COMMENT ON COLUMN public.checkout_builder_configs.traffic_weight IS 'Weight for weighted random split (A/B testing)';
COMMENT ON COLUMN public.checkout_builder_configs.test_started_at IS 'Timestamp when the current A/B test was started for the product';