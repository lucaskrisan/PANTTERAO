
ALTER TABLE public.whatsapp_templates
ADD COLUMN IF NOT EXISTS flow_nodes jsonb NOT NULL DEFAULT '[]'::jsonb;
