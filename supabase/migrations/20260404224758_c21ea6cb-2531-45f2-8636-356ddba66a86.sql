-- WhatsApp send log table
CREATE TABLE public.whatsapp_send_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  order_id uuid,
  customer_phone text,
  template_category text NOT NULL,
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers read own send logs"
  ON public.whatsapp_send_log FOR SELECT TO authenticated
  USING (tenant_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Service role manages send logs"
  ON public.whatsapp_send_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_whatsapp_send_log_tenant ON public.whatsapp_send_log (tenant_id, created_at DESC);

-- WhatsApp feature flags table
CREATE TABLE public.whatsapp_feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature)
);

ALTER TABLE public.whatsapp_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage feature flags"
  ON public.whatsapp_feature_flags FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Producers read own feature flags"
  ON public.whatsapp_feature_flags FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Service role manages feature flags"
  ON public.whatsapp_feature_flags FOR ALL TO service_role
  USING (true) WITH CHECK (true);