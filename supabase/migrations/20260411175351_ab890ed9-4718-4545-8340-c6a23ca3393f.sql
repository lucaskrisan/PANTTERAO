
-- Create cart_recovery_settings table
CREATE TABLE public.cart_recovery_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  email_enabled boolean NOT NULL DEFAULT true,
  email_delay_minutes integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cart_recovery_settings ENABLE ROW LEVEL SECURITY;

-- Producers manage own settings
CREATE POLICY "Producers manage own cart recovery settings"
ON public.cart_recovery_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Service role full access (for cron function)
CREATE POLICY "Service role manages cart recovery settings"
ON public.cart_recovery_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
