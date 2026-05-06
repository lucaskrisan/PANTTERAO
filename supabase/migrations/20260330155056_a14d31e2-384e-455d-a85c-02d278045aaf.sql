
-- 1) Webhook events dedup table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id text PRIMARY KEY,
  gateway text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-cleanup old entries (keep 30 days)
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON public.webhook_events (processed_at);

-- 2) Unique constraint on member_access to prevent duplicate access via race condition
ALTER TABLE public.member_access
  ADD CONSTRAINT member_access_customer_course_unique
  UNIQUE (customer_id, course_id);

-- 3) Status transition: helper to determine valid transitions
-- We handle this in application code, but the dedup table prevents replays
