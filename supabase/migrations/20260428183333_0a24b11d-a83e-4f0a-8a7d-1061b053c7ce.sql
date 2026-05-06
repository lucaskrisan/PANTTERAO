CREATE OR REPLACE FUNCTION public.ab_pick_variant(
  p_test_slug text,
  p_visitor_id text,
  p_link_type text DEFAULT 'page'
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
  _product_id uuid;
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

  -- Record click event + increment counter for A/B analytics
  INSERT INTO public.ab_test_events (test_id, variant_id, visitor_id, event_type)
  VALUES (_test.id, _variant.id, p_visitor_id, 'click');

  UPDATE public.ab_test_variants
  SET clicks = clicks + 1, updated_at = now()
  WHERE id = _variant.id;

  -- Attempt to discover a product_id from the graph for live tracking (pixel_events)
  -- We look for any checkout node in the graph data
  SELECT (n->'data'->>'productId')::uuid INTO _product_id
  FROM jsonb_array_elements(_test.graph->'nodes') n
  WHERE n->>'type' = 'checkout' AND n->'data'->>'productId' IS NOT NULL
  LIMIT 1;

  -- If found, record a PageView in the main tracking system so it shows up in Nina Tracking
  IF _product_id IS NOT NULL THEN
    INSERT INTO public.pixel_events (
      product_id, 
      event_name, 
      source, 
      visitor_id, 
      user_id, 
      event_id
    ) VALUES (
      _product_id,
      'PageView',
      'ab-test',
      p_visitor_id,
      _test.user_id,
      'ab_' || _test.id || '_' || p_visitor_id || '_' || floor(extract(epoch from now()))
    );
  END IF;

  RETURN jsonb_build_object(
    'test_id', _test.id,
    'variant_id', _variant.id,
    'variant_label', _variant.label,
    'mirror_pixel_id', _variant.mirror_pixel_id,
    'redirect_url', _redirect_url,
    'user_id', _test.user_id
  );
END;
$$;