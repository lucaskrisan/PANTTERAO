-- Rate limit tracking table
CREATE TABLE public.rate_limit_hits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL,
  action text NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups by identifier + action + time
CREATE INDEX idx_rate_limit_hits_lookup ON public.rate_limit_hits (identifier, action, created_at DESC);

-- Index for monitoring dashboard queries
CREATE INDEX idx_rate_limit_hits_blocked ON public.rate_limit_hits (blocked, created_at DESC) WHERE blocked = true;

-- Enable RLS
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

-- Super admin can read all rate limit data for monitoring
CREATE POLICY "Super admins can view rate limit data"
  ON public.rate_limit_hits FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Function to check and record rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
  _blocked boolean;
  _window_start timestamp with time zone;
BEGIN
  _window_start := now() - (p_window_seconds || ' seconds')::interval;

  -- Count hits in the current window
  SELECT COUNT(*) INTO _count
  FROM public.rate_limit_hits
  WHERE identifier = p_identifier
    AND action = p_action
    AND created_at >= _window_start;

  _blocked := _count >= p_max_hits;

  -- Record this attempt
  INSERT INTO public.rate_limit_hits (identifier, action, blocked)
  VALUES (p_identifier, p_action, _blocked);

  RETURN _blocked;
END;
$$;

-- Cleanup function: delete records older than 24h
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_hits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limit_hits
  WHERE created_at < now() - interval '24 hours';
  RETURN NEW;
END;
$$;

-- Run cleanup on every 100th insert (probabilistic)
CREATE TRIGGER trg_cleanup_rate_limits
  AFTER INSERT ON public.rate_limit_hits
  FOR EACH ROW
  WHEN (random() < 0.01)
  EXECUTE FUNCTION public.cleanup_rate_limit_hits();