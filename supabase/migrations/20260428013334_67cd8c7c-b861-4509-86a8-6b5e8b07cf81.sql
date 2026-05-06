-- ============================================================
-- A/B TESTING SYSTEM
-- ============================================================

CREATE TABLE public.ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Novo Teste A/B',
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived','completed')),
  -- Distribuição
  traffic_split text NOT NULL DEFAULT 'sticky_50_50' CHECK (traffic_split IN ('sticky_50_50','custom_weights')),
  sticky_days integer NOT NULL DEFAULT 30,
  -- Vencedor automático
  auto_winner_enabled boolean NOT NULL DEFAULT true,
  auto_winner_min_clicks integer NOT NULL DEFAULT 100,
  auto_winner_min_uplift numeric NOT NULL DEFAULT 20,
  winner_variant_id uuid,
  -- Datas
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ab_tests_user ON public.ab_tests(user_id);
CREATE INDEX idx_ab_tests_slug ON public.ab_tests(slug) WHERE status = 'active';

ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own ab_tests"
ON public.ab_tests FOR ALL TO authenticated
USING ((user_id = auth.uid()) OR is_super_admin(auth.uid()))
WITH CHECK ((user_id = auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Service role manages ab_tests"
ON public.ab_tests FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================

CREATE TABLE public.ab_test_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  label text NOT NULL,                    -- "A", "B", "C"
  name text NOT NULL DEFAULT '',
  page_url text,                          -- URL da página de venda
  checkout_url text,                      -- URL do checkout
  weight integer NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
  mirror_pixel_id uuid REFERENCES public.mirror_pixels(id) ON DELETE SET NULL,
  -- Contadores agregados (atualizados via trigger/edge function)
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  sales bigint NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ab_variants_test ON public.ab_test_variants(test_id);

ALTER TABLE public.ab_test_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own variants"
ON public.ab_test_variants FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = ab_test_variants.test_id AND (t.user_id = auth.uid() OR is_super_admin(auth.uid())))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = ab_test_variants.test_id AND (t.user_id = auth.uid() OR is_super_admin(auth.uid())))
);

CREATE POLICY "Service role manages variants"
ON public.ab_test_variants FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Add FK back to ab_tests.winner_variant_id
ALTER TABLE public.ab_tests
  ADD CONSTRAINT ab_tests_winner_variant_fk
  FOREIGN KEY (winner_variant_id) REFERENCES public.ab_test_variants(id) ON DELETE SET NULL;

-- ============================================================

CREATE TABLE public.ab_test_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.ab_test_variants(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_id, visitor_id)
);

CREATE INDEX idx_ab_assignments_visitor ON public.ab_test_assignments(visitor_id);
CREATE INDEX idx_ab_assignments_test ON public.ab_test_assignments(test_id);

ALTER TABLE public.ab_test_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers read own assignments"
ON public.ab_test_assignments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = ab_test_assignments.test_id AND (t.user_id = auth.uid() OR is_super_admin(auth.uid())))
);

CREATE POLICY "Service role manages assignments"
ON public.ab_test_assignments FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================

CREATE TABLE public.ab_test_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.ab_test_variants(id) ON DELETE CASCADE,
  visitor_id text,
  event_type text NOT NULL CHECK (event_type IN ('impression','click','sale')),
  amount numeric DEFAULT 0,
  order_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ab_events_test ON public.ab_test_events(test_id, created_at DESC);
CREATE INDEX idx_ab_events_variant ON public.ab_test_events(variant_id);
CREATE INDEX idx_ab_events_order ON public.ab_test_events(order_id) WHERE order_id IS NOT NULL;

ALTER TABLE public.ab_test_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers read own events"
ON public.ab_test_events FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = ab_test_events.test_id AND (t.user_id = auth.uid() OR is_super_admin(auth.uid())))
);

CREATE POLICY "Service role manages events"
ON public.ab_test_events FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_ab_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ab_tests_updated BEFORE UPDATE ON public.ab_tests
FOR EACH ROW EXECUTE FUNCTION public.update_ab_updated_at();

CREATE TRIGGER trg_ab_variants_updated BEFORE UPDATE ON public.ab_test_variants
FOR EACH ROW EXECUTE FUNCTION public.update_ab_updated_at();

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Pick a variant for a visitor (sticky by visitor_id)
CREATE OR REPLACE FUNCTION public.ab_pick_variant(
  p_test_slug text,
  p_visitor_id text,
  p_link_type text DEFAULT 'page' -- 'page' or 'checkout'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _test public.ab_tests%ROWTYPE;
  _variant public.ab_test_variants%ROWTYPE;
  _existing_id uuid;
  _total_weight integer;
  _r integer;
  _running integer := 0;
  _v record;
  _redirect_url text;
BEGIN
  SELECT * INTO _test FROM public.ab_tests WHERE slug = p_test_slug AND status = 'active' LIMIT 1;
  IF _test.id IS NULL THEN
    RETURN jsonb_build_object('error', 'test_not_active');
  END IF;

  -- If winner already chosen, always serve winner
  IF _test.winner_variant_id IS NOT NULL THEN
    SELECT * INTO _variant FROM public.ab_test_variants WHERE id = _test.winner_variant_id;
  ELSE
    -- Sticky lookup
    SELECT variant_id INTO _existing_id
    FROM public.ab_test_assignments
    WHERE test_id = _test.id AND visitor_id = p_visitor_id
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF _existing_id IS NOT NULL THEN
      SELECT * INTO _variant FROM public.ab_test_variants WHERE id = _existing_id;
    ELSE
      -- Weighted random selection
      SELECT COALESCE(SUM(weight), 0) INTO _total_weight FROM public.ab_test_variants WHERE test_id = _test.id;
      IF _total_weight <= 0 THEN
        RETURN jsonb_build_object('error', 'no_variants');
      END IF;
      _r := floor(random() * _total_weight)::int;
      FOR _v IN SELECT * FROM public.ab_test_variants WHERE test_id = _test.id ORDER BY sort_order, label LOOP
        _running := _running + _v.weight;
        IF _r < _running THEN
          SELECT * INTO _variant FROM public.ab_test_variants WHERE id = _v.id;
          EXIT;
        END IF;
      END LOOP;

      -- Persist assignment
      INSERT INTO public.ab_test_assignments (test_id, variant_id, visitor_id, expires_at)
      VALUES (_test.id, _variant.id, p_visitor_id, now() + (_test.sticky_days || ' days')::interval)
      ON CONFLICT (test_id, visitor_id) DO NOTHING;
    END IF;
  END IF;

  IF _variant.id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_variant');
  END IF;

  -- Choose URL based on link_type
  _redirect_url := CASE WHEN p_link_type = 'checkout' THEN _variant.checkout_url ELSE _variant.page_url END;

  -- Record click event + increment counter
  INSERT INTO public.ab_test_events (test_id, variant_id, visitor_id, event_type)
  VALUES (_test.id, _variant.id, p_visitor_id, 'click');

  UPDATE public.ab_test_variants
  SET clicks = clicks + 1, updated_at = now()
  WHERE id = _variant.id;

  RETURN jsonb_build_object(
    'test_id', _test.id,
    'variant_id', _variant.id,
    'variant_label', _variant.label,
    'mirror_pixel_id', _variant.mirror_pixel_id,
    'redirect_url', _redirect_url
  );
END;
$$;

-- Record a sale conversion against a variant (called from process-order-paid)
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
  END LOOP;

  RETURN true;
END;
$$;

-- Auto-pick winner: returns variant_id if a clear winner exists per the test's threshold
CREATE OR REPLACE FUNCTION public.ab_evaluate_winner(p_test_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _test public.ab_tests%ROWTYPE;
  _best record;
  _second record;
  _uplift numeric;
BEGIN
  SELECT * INTO _test FROM public.ab_tests WHERE id = p_test_id;
  IF _test.id IS NULL OR NOT _test.auto_winner_enabled OR _test.winner_variant_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Need every variant to have at least min_clicks
  IF EXISTS (SELECT 1 FROM public.ab_test_variants WHERE test_id = p_test_id AND clicks < _test.auto_winner_min_clicks) THEN
    RETURN NULL;
  END IF;

  -- Top 2 variants by conversion rate
  SELECT id, CASE WHEN clicks > 0 THEN sales::numeric / clicks ELSE 0 END AS conv
  INTO _best
  FROM public.ab_test_variants WHERE test_id = p_test_id
  ORDER BY conv DESC LIMIT 1;

  SELECT id, CASE WHEN clicks > 0 THEN sales::numeric / clicks ELSE 0 END AS conv
  INTO _second
  FROM public.ab_test_variants WHERE test_id = p_test_id AND id != _best.id
  ORDER BY conv DESC LIMIT 1;

  IF _second.conv IS NULL OR _second.conv = 0 THEN
    RETURN _best.id;
  END IF;

  _uplift := ((_best.conv - _second.conv) / _second.conv) * 100;
  IF _uplift >= _test.auto_winner_min_uplift THEN
    UPDATE public.ab_tests SET winner_variant_id = _best.id WHERE id = p_test_id;
    RETURN _best.id;
  END IF;

  RETURN NULL;
END;
$$;