
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  send_pending boolean NOT NULL DEFAULT false,
  send_approved boolean NOT NULL DEFAULT true,
  show_value text NOT NULL DEFAULT 'commission',
  show_product_name boolean NOT NULL DEFAULT false,
  show_utm_campaign boolean NOT NULL DEFAULT false,
  show_dashboard_name boolean NOT NULL DEFAULT false,
  notification_pattern text NOT NULL DEFAULT 'creative',
  report_08 boolean NOT NULL DEFAULT false,
  report_12 boolean NOT NULL DEFAULT false,
  report_18 boolean NOT NULL DEFAULT false,
  report_23 boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification settings"
  ON public.notification_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
