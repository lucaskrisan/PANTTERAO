-- Add targeting rules and conversion goal to ab_tests
ALTER TABLE public.ab_tests 
ADD COLUMN IF NOT EXISTS targeting_rules JSONB DEFAULT '{"devices": [], "utm_filters": []}'::jsonb,
ADD COLUMN IF NOT EXISTS conversion_goal TEXT DEFAULT 'purchase';

COMMENT ON COLUMN public.ab_tests.targeting_rules IS 'Targeting rules like {"devices": ["mobile", "desktop"], "utm_filters": [{"key": "utm_source", "value": "google"}]}';
COMMENT ON COLUMN public.ab_tests.conversion_goal IS 'The main metric to optimize for (purchase, lead, click)';