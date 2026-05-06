-- Adicionar colunas de monitoramento em product_pixels
ALTER TABLE public.product_pixels
  ADD COLUMN IF NOT EXISTS token_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_health_check_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_event_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_product_pixels_token_status ON public.product_pixels(token_status);
CREATE INDEX IF NOT EXISTS idx_product_pixels_last_event_at ON public.product_pixels(last_event_at);

-- RPC: métricas agregadas de feedback (Super Admin only)
CREATE OR REPLACE FUNCTION public.get_pixel_feedback_metrics(
  p_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  _since timestamp with time zone;
BEGIN
  -- Apenas super admins podem ler
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admin';
  END IF;

  _since := now() - (p_days || ' days')::interval;

  WITH pixels AS (
    SELECT
      pp.id,
      pp.pixel_id,
      pp.product_id,
      pp.platform,
      pp.domain,
      pp.token_status,
      pp.last_health_check_at,
      pp.last_event_at,
      pp.capi_token IS NOT NULL AS has_token,
      pp.created_at,
      p.name AS product_name
    FROM public.product_pixels pp
    LEFT JOIN public.products p ON p.id = pp.product_id
  ),
  events_window AS (
    SELECT
      pe.product_id,
      pe.event_name,
      pe.source,
      COUNT(*) AS cnt
    FROM public.pixel_events pe
    WHERE pe.created_at >= _since
    GROUP BY pe.product_id, pe.event_name, pe.source
  ),
  pixel_event_summary AS (
    SELECT
      px.id AS pixel_row_id,
      px.pixel_id,
      px.product_id,
      jsonb_agg(
        jsonb_build_object(
          'event_name', ew.event_name,
          'source', ew.source,
          'count', ew.cnt
        )
      ) FILTER (WHERE ew.event_name IS NOT NULL) AS events
    FROM pixels px
    LEFT JOIN events_window ew ON ew.product_id = px.product_id
    GROUP BY px.id, px.pixel_id, px.product_id
  ),
  emq_window AS (
    SELECT
      es.pixel_id,
      es.product_id,
      es.event_name,
      AVG(es.emq_score) AS avg_emq,
      AVG(es.dedup_rate) AS avg_dedup,
      AVG(es.vid_coverage) AS avg_vid,
      SUM(es.browser_count) AS browser_total,
      SUM(es.server_count) AS server_total,
      SUM(es.dual_count) AS dual_total
    FROM public.emq_snapshots es
    WHERE es.snapshot_date >= (_since)::date
    GROUP BY es.pixel_id, es.product_id, es.event_name
  ),
  pixel_emq_summary AS (
    SELECT
      px.id AS pixel_row_id,
      jsonb_agg(
        jsonb_build_object(
          'event_name', emq.event_name,
          'avg_emq', ROUND(COALESCE(emq.avg_emq, 0)::numeric, 2),
          'avg_dedup', ROUND(COALESCE(emq.avg_dedup, 0)::numeric, 2),
          'avg_vid', ROUND(COALESCE(emq.avg_vid, 0)::numeric, 2),
          'browser', COALESCE(emq.browser_total, 0),
          'server', COALESCE(emq.server_total, 0),
          'dual', COALESCE(emq.dual_total, 0)
        )
      ) FILTER (WHERE emq.event_name IS NOT NULL) AS emq_rows
    FROM pixels px
    LEFT JOIN emq_window emq ON emq.pixel_id = px.pixel_id AND emq.product_id = px.product_id
    GROUP BY px.id
  ),
  products_without_pixel AS (
    SELECT p.id, p.name, p.active
    FROM public.products p
    WHERE p.active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.product_pixels pp WHERE pp.product_id = p.id
      )
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'window_days', p_days,
    'pixels', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', px.id,
          'pixel_id', px.pixel_id,
          'product_id', px.product_id,
          'product_name', px.product_name,
          'platform', px.platform,
          'domain', px.domain,
          'has_token', px.has_token,
          'token_status', px.token_status,
          'last_health_check_at', px.last_health_check_at,
          'last_event_at', px.last_event_at,
          'created_at', px.created_at,
          'events', COALESCE(pes.events, '[]'::jsonb),
          'emq_by_event', COALESCE(pem.emq_rows, '[]'::jsonb)
        )
      )
      FROM pixels px
      LEFT JOIN pixel_event_summary pes ON pes.pixel_row_id = px.id
      LEFT JOIN pixel_emq_summary pem ON pem.pixel_row_id = px.id
    ), '[]'::jsonb),
    'products_without_pixel', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name))
      FROM products_without_pixel
    ), '[]'::jsonb),
    'total_events', (SELECT COALESCE(SUM(cnt), 0) FROM events_window),
    'total_purchase_events', (SELECT COALESCE(SUM(cnt), 0) FROM events_window WHERE event_name = 'Purchase')
  ) INTO result;

  RETURN result;
END;
$$;

-- RPC: atualizar token de pixel (Super Admin only)
CREATE OR REPLACE FUNCTION public.update_pixel_token(
  p_pixel_row_id uuid,
  p_new_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rows integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admin';
  END IF;

  IF p_new_token IS NULL OR length(trim(p_new_token)) < 20 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  UPDATE public.product_pixels
  SET capi_token = trim(p_new_token),
      token_status = 'unknown',
      last_health_check_at = NULL
  WHERE id = p_pixel_row_id;

  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows > 0;
END;
$$;