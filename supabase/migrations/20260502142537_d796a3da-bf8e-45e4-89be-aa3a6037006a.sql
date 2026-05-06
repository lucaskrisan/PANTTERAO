-- Create the function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create table for Meta Business WhatsApp configurations
CREATE TABLE public.whatsapp_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    whatsapp_business_id TEXT,
    whatsapp_access_token TEXT,
    whatsapp_phone_number_id TEXT,
    status TEXT DEFAULT 'inactive',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Super Admins can manage all configs" 
ON public.whatsapp_configs 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'
  )
);

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_whatsapp_configs_updated_at
BEFORE UPDATE ON public.whatsapp_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();