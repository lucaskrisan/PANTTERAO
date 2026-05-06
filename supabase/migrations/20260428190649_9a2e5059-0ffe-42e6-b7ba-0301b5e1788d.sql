
ALTER TABLE public.ab_test_variants
ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ab_pick_variant(p_test_slug text, p_visitor_id text, p_link_type text DEFAULT 'page'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _existing_paused boolean;
BEGIN
  SELECT * INTO _test FROM public.ab_tests WHERE slug = p_test_slug AND status = 'active' LIMIT 1;
  IF _test.id IS NULL THEN
    RETURN jsonb_build_object('error', 'test_not_active');
  END IF;

  -- If winner already chosen, always serve winner (even if paused — explicit choice)
  IF _test.winner_variant_id IS NOT NULL THEN
    SELECT * INTO _variant FROM public.ab_test_variants WHERE id = _test.winner_variant_id;
  ELSE
    -- Sticky lookup — but only honor it if the assigned variant is NOT paused
    SELECT a.variant_id, v.paused INTO _existing_id, _existing_paused
    FROM public.ab_test_assignments a
    JOIN public.ab_test_variants v ON v.id = a.variant_id
    WHERE a.test_id = _test.id AND a.visitor_id = p_visitor_id
      AND (a.expires_at IS NULL OR a.expires_at > now())
    LIMIT 1;

    IF _existing_id IS NOT NULL AND COALESCE(_existing_paused, false) = false THEN
      SELECT * INTO _variant FROM public.ab_test_variants WHERE id = _existing_id;
    ELSE
      -- If sticky exists but is paused, drop it so we can re-assign
      IF _existing_id IS NOT NULL AND _existing_paused = true THEN
        DELETE FROM public.ab_test_assignments
        WHERE test_id = _test.id AND visitor_id = p_visitor_id;
      END IF;

      -- Weighted random selection — ONLY active (non-paused) variants
      SELECT COALESCE(SUM(weight), 0) INTO _total_weight
      FROM public.ab_test_variants
      WHERE test_id = _test.id AND COALESCE(paused, false) = false;

      IF _total_weight <= 0 THEN
        RETURN jsonb_build_object('error', 'no_active_variants');
      END IF;
      _r := floor(random() * _total_weight)::int;
      FOR _v IN
        SELECT * FROM public.ab_test_variants
        WHERE test_id = _test.id AND COALESCE(paused, false) = false
        ORDER BY sort_order, label
      LOOP
        _running := _running + _v.weight;
        IF _r < _running THEN
          SELECT * INTO _variant FROM public.ab_test_variants WHERE id = _v.id;
          EXIT;
        END IF;
      END LOOP;

      -- Persist assignment
      INSERT INTO public.ab_test_assignments (test_id, variant_id, visitor_id, expires_at)
      VALUES (_test.id, _variant.id, p_visitor_id, now() + (_test.sticky_days || ' days')::interval)
      ON CONFLICT (test_id, visitor_id) DO UPDATE SET variant_id = EXCLUDED.variant_id, expires_at = EXCLUDED.expires_at;
    END IF;
  END IF;

  IF _variant.id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_variant');
  END IF;

  _redirect_url := CASE WHEN p_link_type = 'checkout' THEN _variant.checkout_url ELSE _variant.page_url END;

  INSERT INTO public.ab_test_events (test_id, variant_id, visitor_id, event_type)
  VALUES (_test.id, _variant.id, p_visitor_id, 'click');

  UPDATE public.ab_test_variants
  SET clicks = clicks + 1, updated_at = now()
  WHERE id = _variant.id;

  SELECT (n->'data'->>'productId')::uuid INTO _product_id
  FROM jsonb_array_elements(_test.graph->'nodes') n
  WHERE n->>'type' = 'checkout' AND n->'data'->>'productId' IS NOT NULL
  LIMIT 1;

  IF _product_id IS NOT NULL THEN
    INSERT INTO public.pixel_events (
      product_id, event_name, source, visitor_id, user_id, event_id
    ) VALUES (
      _product_id, 'PageView', 'ab-test', p_visitor_id, _test.user_id,
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
$function$;
