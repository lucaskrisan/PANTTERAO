
-- Add accountability fields
ALTER TABLE public.recovery_opportunities
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ;

-- Drop old check constraint and re-add with new statuses
ALTER TABLE public.recovery_opportunities
  DROP CONSTRAINT IF EXISTS recovery_opportunities_status_check;
ALTER TABLE public.recovery_opportunities
  ADD CONSTRAINT recovery_opportunities_status_check
  CHECK (status = ANY (ARRAY['claimed','contacted','recovered','no_response','refused','expired','lost']));

-- Unique partial index: each lead can only have ONE active claim
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_claim
  ON public.recovery_opportunities (reference_id, type)
  WHERE status IN ('claimed','contacted');

-- Realtime
ALTER TABLE public.recovery_opportunities REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'recovery_opportunities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recovery_opportunities;
  END IF;
END $$;
