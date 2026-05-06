CREATE TABLE public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  instance_id text NOT NULL,
  node_url text NOT NULL DEFAULT 'https://api.panterapay.com.br',
  status text NOT NULL DEFAULT 'disconnected',
  phone_number text,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own whatsapp sessions"
  ON public.whatsapp_sessions FOR ALL TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Service role manages whatsapp sessions"
  ON public.whatsapp_sessions FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.pending_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  instance_id text NOT NULL,
  to_number text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own pending sends"
  ON public.pending_sends FOR ALL TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Service role manages pending sends"
  ON public.pending_sends FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);