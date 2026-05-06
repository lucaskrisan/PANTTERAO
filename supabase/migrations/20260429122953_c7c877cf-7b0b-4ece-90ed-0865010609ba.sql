ALTER TABLE public.pixel_events
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pixel_events_human_only
  ON public.pixel_events (user_id, created_at DESC)
  WHERE is_bot = false;

COMMENT ON COLUMN public.pixel_events.is_bot IS
  'true quando o evento foi gerado por bot/crawler (heurística client-side em src/lib/botDetection.ts). Excluído do dashboard de tracking e do CAPI.';