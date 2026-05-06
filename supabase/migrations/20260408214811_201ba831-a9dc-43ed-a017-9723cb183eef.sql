
CREATE TABLE public.dashboard_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  visible_metrics JSONB NOT NULL DEFAULT '["card_approval","pix_sales","refund","paid_ads","organic","pending","abandoned","avg_ticket"]'::jsonb,
  metrics_order JSONB NOT NULL DEFAULT '["card_approval","pix_sales","refund","paid_ads","organic","pending","abandoned","avg_ticket"]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dashboard preferences"
  ON public.dashboard_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
