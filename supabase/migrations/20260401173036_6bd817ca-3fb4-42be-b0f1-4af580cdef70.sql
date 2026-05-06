
-- Create UTMify integrations table (mirrors appsell_integrations)
CREATE TABLE public.utmify_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one integration per producer
ALTER TABLE public.utmify_integrations ADD CONSTRAINT utmify_integrations_user_id_key UNIQUE (user_id);

-- Enable RLS
ALTER TABLE public.utmify_integrations ENABLE ROW LEVEL SECURITY;

-- Producers can view their own
CREATE POLICY "Users can view own utmify integration"
  ON public.utmify_integrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Producers can insert their own
CREATE POLICY "Users can insert own utmify integration"
  ON public.utmify_integrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Producers can update their own
CREATE POLICY "Users can update own utmify integration"
  ON public.utmify_integrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Super admins can view all
CREATE POLICY "Super admins can view all utmify integrations"
  ON public.utmify_integrations FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
