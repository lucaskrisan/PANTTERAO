
CREATE TABLE public.pixel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  event_name text NOT NULL,
  source text NOT NULL DEFAULT 'browser',
  event_id text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pixel_events_user_created ON public.pixel_events (user_id, created_at DESC);
CREATE INDEX idx_pixel_events_product ON public.pixel_events (product_id, created_at DESC);

ALTER TABLE public.pixel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers read own events"
  ON public.pixel_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public insert events"
  ON public.pixel_events FOR INSERT TO public
  WITH CHECK (product_id IS NOT NULL AND event_name IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_events;
