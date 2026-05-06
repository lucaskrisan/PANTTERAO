
CREATE TABLE public.emq_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  pixel_id text NOT NULL,
  event_name text NOT NULL,
  emq_score numeric NULL,
  browser_count integer DEFAULT 0,
  server_count integer DEFAULT 0,
  dual_count integer DEFAULT 0,
  vid_coverage integer DEFAULT 0,
  dedup_rate integer DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, pixel_id, event_name, snapshot_date)
);

ALTER TABLE public.emq_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own EMQ snapshots"
ON public.emq_snapshots FOR SELECT TO authenticated
USING (
  product_id IN (
    SELECT id FROM public.products WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert EMQ snapshots"
ON public.emq_snapshots FOR INSERT
WITH CHECK (true);
