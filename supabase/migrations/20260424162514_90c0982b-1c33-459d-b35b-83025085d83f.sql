-- 1. Remove pixel_events do Realtime (estavam vazando para todos os logados)
ALTER PUBLICATION supabase_realtime DROP TABLE public.pixel_events;

-- 2. Reforça RLS de payment_gateways: garante que SOMENTE o dono e super_admin leiam config
-- (RLS já existe, mas reforçamos com policy explícita e revogamos GRANT desnecessário)
REVOKE ALL ON public.payment_gateways FROM anon;
REVOKE ALL ON public.payment_gateways FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateways TO authenticated;

-- Garante que policies estritas existem (idempotente)
DO $$ 
BEGIN
  -- Drop policy permissiva antiga se existir
  DROP POLICY IF EXISTS "Public read gateways" ON public.payment_gateways;
  DROP POLICY IF EXISTS "Anyone can view gateways" ON public.payment_gateways;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;