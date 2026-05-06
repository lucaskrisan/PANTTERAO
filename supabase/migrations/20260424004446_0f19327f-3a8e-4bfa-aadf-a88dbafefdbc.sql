-- ============================================================
-- 1. REALTIME RLS — restringir broadcast por tenant
-- ============================================================
-- Habilita RLS em realtime.messages (canal de broadcast)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados só podem receber mensagens de canais
-- prefixados com seu próprio user_id (ex: "user:<uuid>:pixel_events")
-- ou super_admins podem ouvir tudo.
DROP POLICY IF EXISTS "Tenant-scoped realtime read" ON realtime.messages;
CREATE POLICY "Tenant-scoped realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (realtime.topic() LIKE 'user:' || auth.uid()::text || ':%')
  OR (realtime.topic() LIKE 'public:%')
);

-- ============================================================
-- 2. CHECKOUT_SETTINGS — fechar enumeração anônima
-- ============================================================
-- Remove qualquer policy anônima ampla e recria exigindo filtro por user_id
DROP POLICY IF EXISTS "Public can view checkout settings" ON public.checkout_settings;
DROP POLICY IF EXISTS "Anyone can view checkout settings" ON public.checkout_settings;
DROP POLICY IF EXISTS "Checkout settings are viewable by everyone" ON public.checkout_settings;

-- Cria função SECURITY DEFINER para leitura pública controlada por user_id específico
CREATE OR REPLACE FUNCTION public.get_checkout_settings(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  logo_url text,
  primary_color text,
  custom_css text,
  company_name text,
  pix_discount_percent numeric,
  show_countdown boolean,
  countdown_minutes integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cs.user_id,
    cs.logo_url,
    cs.primary_color,
    cs.custom_css,
    cs.company_name,
    cs.pix_discount_percent,
    cs.show_countdown,
    cs.countdown_minutes
  FROM public.checkout_settings cs
  WHERE cs.user_id = p_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_checkout_settings(uuid) TO anon, authenticated;

-- ============================================================
-- 3. VERIFICATION-DOCUMENTS — políticas explícitas UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "Users can update own verification documents" ON storage.objects;
CREATE POLICY "Users can update own verification documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'verification-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own verification documents" ON storage.objects;
CREATE POLICY "Users can delete own verification documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);