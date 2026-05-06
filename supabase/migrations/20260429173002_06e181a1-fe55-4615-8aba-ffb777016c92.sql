CREATE TABLE public.gatflow_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  shop_id TEXT,
  api_secret TEXT,
  active BOOLEAN DEFAULT false,
  plan_tier TEXT DEFAULT 'starter',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gatflow_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own gatflow integration"
ON public.gatflow_integrations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gatflow integration"
ON public.gatflow_integrations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gatflow integration"
ON public.gatflow_integrations
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at using existing set_updated_at function
CREATE TRIGGER update_gatflow_integrations_updated_at
BEFORE UPDATE ON public.gatflow_integrations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
