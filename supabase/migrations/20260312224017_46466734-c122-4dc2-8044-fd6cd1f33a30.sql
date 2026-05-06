
CREATE TABLE public.pwa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  app_name text NOT NULL DEFAULT 'PayCheckout',
  short_name text NOT NULL DEFAULT 'PayCheckout',
  description text DEFAULT 'Plataforma de vendas',
  theme_color text NOT NULL DEFAULT '#16a34a',
  background_color text NOT NULL DEFAULT '#ffffff',
  icon_192_url text,
  icon_512_url text,
  splash_image_url text,
  notification_title text DEFAULT '💰 Nova venda!',
  notification_body text DEFAULT 'Você recebeu uma nova venda de {product} no valor de {value}',
  notification_icon_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.pwa_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pwa settings"
  ON public.pwa_settings FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public read pwa settings"
  ON public.pwa_settings FOR SELECT TO public
  USING (true);
