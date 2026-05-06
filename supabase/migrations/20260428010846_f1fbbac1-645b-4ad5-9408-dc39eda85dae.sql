CREATE TABLE public.mirror_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_id text NOT NULL,
  capi_token text NOT NULL,
  label text NOT NULL DEFAULT 'Pixel Espelho',
  active boolean NOT NULL DEFAULT true,
  fire_on_events text[] NOT NULL DEFAULT ARRAY['Purchase','InitiateCheckout','AddPaymentInfo','Lead','ViewContent','PageView'],
  event_source_url_override text,
  total_events_sent integer NOT NULL DEFAULT 0,
  last_event_at timestamptz,
  last_meta_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mirror_pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage mirror pixels"
ON public.mirror_pixels FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Service role manages mirror pixels"
ON public.mirror_pixels FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_mirror_pixels_active ON public.mirror_pixels(active) WHERE active = true;