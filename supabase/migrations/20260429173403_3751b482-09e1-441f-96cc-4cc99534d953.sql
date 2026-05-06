CREATE TABLE public.marketplace_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  client_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  shared_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_partners ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to see partners (for integration list)
CREATE POLICY "Users can view partners"
ON public.marketplace_partners
FOR SELECT
USING (auth.role() = 'authenticated');

-- Standard updated_at trigger
CREATE TRIGGER update_marketplace_partners_updated_at
BEFORE UPDATE ON public.marketplace_partners
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Insert initial GatFlow partner entry
INSERT INTO public.marketplace_partners (name) VALUES ('GatFlow');
