
-- Função para incrementar estatísticas de forma atômica
CREATE OR REPLACE FUNCTION public.increment_ab_variant_stat(
  p_variant_id uuid,
  p_field text -- 'impressions', 'clicks', 'sales'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_field = 'impressions' THEN
    UPDATE public.ab_test_variants SET impressions = impressions + 1, updated_at = now() WHERE id = p_variant_id;
  ELSIF p_field = 'clicks' THEN
    UPDATE public.ab_test_variants SET clicks = clicks + 1, updated_at = now() WHERE id = p_variant_id;
  ELSIF p_field = 'sales' THEN
    UPDATE public.ab_test_variants SET sales = sales + 1, updated_at = now() WHERE id = p_variant_id;
  END IF;
END;
$$;

-- Garantir que super_admin e service_role possam executar
GRANT EXECUTE ON FUNCTION public.increment_ab_variant_stat(uuid, text) TO authenticated, service_role;

-- Atualizar ab_record_conversion para disparar avaliação de vencedor
CREATE OR REPLACE FUNCTION public.ab_record_conversion(
  p_visitor_id text,
  p_order_id uuid,
  p_amount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _assignment record;
  _already_counted integer;
BEGIN
  IF p_visitor_id IS NULL OR p_visitor_id = '' THEN RETURN false; END IF;

  -- Find latest assignment for this visitor (could belong to multiple tests)
  FOR _assignment IN
    SELECT a.test_id, a.variant_id
    FROM public.ab_test_assignments a
    JOIN public.ab_tests t ON t.id = a.test_id
    WHERE a.visitor_id = p_visitor_id
      AND t.status = 'active'
  LOOP
    -- Dedup: don't double-count a sale per (variant, order)
    SELECT COUNT(*) INTO _already_counted FROM public.ab_test_events
    WHERE variant_id = _assignment.variant_id AND order_id = p_order_id AND event_type = 'sale';
    IF _already_counted > 0 THEN CONTINUE; END IF;

    INSERT INTO public.ab_test_events (test_id, variant_id, visitor_id, event_type, amount, order_id)
    VALUES (_assignment.test_id, _assignment.variant_id, p_visitor_id, 'sale', COALESCE(p_amount, 0), p_order_id);

    UPDATE public.ab_test_variants
    SET sales = sales + 1, revenue = revenue + COALESCE(p_amount, 0), updated_at = now()
    WHERE id = _assignment.variant_id;

    -- Avaliar se há um vencedor automático após cada venda
    PERFORM public.ab_evaluate_winner(_assignment.test_id);
  END LOOP;

  RETURN true;
END;
$$;
