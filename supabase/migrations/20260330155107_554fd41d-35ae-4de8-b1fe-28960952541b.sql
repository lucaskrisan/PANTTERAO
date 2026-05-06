
-- Enable RLS on webhook_events and restrict to service role only
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- No public policies - only service_role can access this table
