
-- Checkout template marketplace table
CREATE TABLE public.checkout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  thumbnail_url TEXT,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  published BOOLEAN NOT NULL DEFAULT false,
  uses_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_templates ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view published templates
CREATE POLICY "Anyone can view published templates"
  ON public.checkout_templates FOR SELECT
  TO authenticated
  USING (published = true);

-- Super admins can do everything
CREATE POLICY "Super admins manage templates"
  ON public.checkout_templates FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
