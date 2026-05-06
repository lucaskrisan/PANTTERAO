-- RPC server-side para Atribuição UTM (sem teto de 1000 linhas, com período e moeda)
CREATE OR REPLACE FUNCTION public.get_utm_attribution(
  p_user_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  source text,
  campaign text,
  medium text,
  currency text,
  count bigint,
  revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(o.metadata->>'utm_source', ''), '(direto)')        AS source,
    COALESCE(NULLIF(o.metadata->>'utm_campaign', ''), '(sem campanha)') AS campaign,
    COALESCE(NULLIF(o.metadata->>'utm_medium', ''), '(sem medium)')    AS medium,
    UPPER(COALESCE(NULLIF(o.metadata->>'currency', ''), 'BRL'))        AS currency,
    COUNT(*)::bigint                                                    AS count,
    COALESCE(SUM(o.amount), 0)::numeric                                 AS revenue
  FROM public.orders o
  WHERE o.user_id = p_user_id
    AND o.status IN ('paid','approved','confirmed')
    AND o.created_at >= (now() - make_interval(days => GREATEST(p_days, 1)))
    AND (
      auth.uid() = p_user_id
      OR public.is_super_admin(auth.uid())
    )
  GROUP BY 1,2,3,4
  ORDER BY revenue DESC;
$$;

REVOKE ALL ON FUNCTION public.get_utm_attribution(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_utm_attribution(uuid, integer) TO authenticated;