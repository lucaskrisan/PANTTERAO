
-- 1. Expandir recovery_opportunities com colunas para devolução
ALTER TABLE public.recovery_opportunities
  ADD COLUMN IF NOT EXISTS released_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS released_reason text;

-- 2. Tabela de auditoria de devoluções
CREATE TABLE IF NOT EXISTS public.recovery_release_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_id uuid NOT NULL,
  collaborator_id uuid NOT NULL,
  reason text,
  released_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_release_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collaborators see own release log"
  ON public.recovery_release_log FOR SELECT
  USING (auth.uid() = collaborator_id);

CREATE POLICY "Super admins see all release log"
  ON public.recovery_release_log FOR SELECT
  USING (is_super_admin(auth.uid()));

-- 3. RPC para devolver lead com limite anti-abuso (3/dia)
CREATE OR REPLACE FUNCTION public.release_recovery(
  p_recovery_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  -- Verifica posse
  SELECT collaborator_id INTO v_owner
    FROM public.recovery_opportunities
   WHERE id = p_recovery_id;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Limite diário
  SELECT count(*) INTO v_count
    FROM public.recovery_release_log
   WHERE collaborator_id = v_uid
     AND released_at > now() - interval '24 hours';

  IF v_count >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_limit',
      'message', 'Você já devolveu 3 leads nas últimas 24h. Foque nos atuais.');
  END IF;

  -- Log + remoção
  INSERT INTO public.recovery_release_log(recovery_id, collaborator_id, reason)
    VALUES (p_recovery_id, v_uid, p_reason);

  DELETE FROM public.recovery_opportunities WHERE id = p_recovery_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_recovery(uuid, text) TO authenticated;

-- 4. View ampliada: janelas maiores + flag "quente" + contagem de compras do cliente
CREATE OR REPLACE VIEW public.unclaimed_opportunities AS
WITH claimed_ids AS (
  SELECT reference_id, type
    FROM public.recovery_opportunities
   WHERE status IN ('claimed', 'contacted')
)
SELECT
  'abandoned_cart'::text AS type,
  ac.id AS reference_id,
  ac.customer_name,
  ac.customer_phone,
  ac.product_price AS amount,
  ac.created_at,
  p.name AS product_name,
  ac.product_id,
  (ac.created_at > now() - interval '1 hour') AS is_hot,
  COALESCE((
    SELECT count(*) FROM public.orders o2
     WHERE o2.customer_id IN (
       SELECT c2.id FROM public.customers c2 WHERE c2.email = ac.customer_email
     )
       AND o2.status = 'paid'
  ), 0)::int AS customer_purchases_count
FROM public.abandoned_carts ac
LEFT JOIN public.products p ON ac.product_id = p.id
WHERE ac.recovered = false
  AND ac.created_at > now() - interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM claimed_ids ci
     WHERE ci.reference_id = ac.id AND ci.type = 'abandoned_cart'
  )

UNION ALL

SELECT
  'pix'::text AS type,
  o.id AS reference_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  o.amount,
  o.created_at,
  p.name AS product_name,
  o.product_id,
  (o.created_at > now() - interval '1 hour') AS is_hot,
  COALESCE((
    SELECT count(*) FROM public.orders o2
     WHERE o2.customer_id = o.customer_id AND o2.status = 'paid'
  ), 0)::int AS customer_purchases_count
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id
LEFT JOIN public.products p ON o.product_id = p.id
WHERE o.payment_method = 'pix'
  AND o.status IN ('pending', 'expired')
  AND o.created_at > now() - interval '72 hours'
  AND NOT EXISTS (
    SELECT 1 FROM claimed_ids ci
     WHERE ci.reference_id = o.id AND ci.type = 'pix'
  );

GRANT SELECT ON public.unclaimed_opportunities TO authenticated;
