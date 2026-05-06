
CREATE TABLE public.product_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'facebook',
  pixel_id text NOT NULL,
  domain text,
  fire_on_pix boolean NOT NULL DEFAULT false,
  fire_on_boleto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid
);

ALTER TABLE public.product_pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own pixels"
  ON public.product_pixels FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public read pixels for checkout"
  ON public.product_pixels FOR SELECT TO public
  USING (true);
