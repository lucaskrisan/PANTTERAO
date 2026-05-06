
-- Add clarity_project_id to platform_settings for Clarity integration
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS clarity_project_id text;

-- Add customer_state to orders for geographic analytics
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_state text;

-- Index for state-based analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_state ON public.orders (customer_state) WHERE customer_state IS NOT NULL;
