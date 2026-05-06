
-- Maria AI settings table for super admin control
CREATE TABLE public.maria_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_url text DEFAULT NULL,
  persona_name text NOT NULL DEFAULT 'Maria 🌸',
  system_prompt text NOT NULL DEFAULT 'Você é a MARIA 🌸 — a assistente inteligente e acolhedora. Calorosa, inteligente e genuína. Nunca robótica ou genérica.',
  temperature numeric NOT NULL DEFAULT 0.7,
  max_tokens integer NOT NULL DEFAULT 500,
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  cross_sell_enabled boolean NOT NULL DEFAULT true,
  auto_reply_on_approve boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  total_replies integer NOT NULL DEFAULT 0,
  total_tokens_used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.maria_ai_settings (id) VALUES (gen_random_uuid());

-- RLS
ALTER TABLE public.maria_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage maria settings" ON public.maria_ai_settings
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Service role manages maria settings" ON public.maria_ai_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
