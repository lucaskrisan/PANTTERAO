-- Create a function to evaluate and set an A/B test winner
CREATE OR REPLACE FUNCTION public.ab_evaluate_winner(p_test_id uuid)
RETURNS uuid AS $$
DECLARE
    _test public.ab_tests%ROWTYPE;
    _winner_id uuid := NULL;
    _best_conversion numeric := -1;
    _current_conversion numeric;
    _v record;
    _total_clicks bigint := 0;
BEGIN
    SELECT * INTO _test FROM public.ab_tests WHERE id = p_test_id;
    
    -- Only evaluate if auto-winner is enabled and no winner is set yet
    IF _test.auto_winner_enabled = false OR _test.winner_variant_id IS NOT NULL THEN
        RETURN _test.winner_variant_id;
    END IF;

    -- Check if any variant has reached the minimum clicks threshold
    FOR _v IN SELECT id, clicks, impressions FROM public.ab_test_variants WHERE test_id = p_test_id LOOP
        _total_clicks := _total_clicks + _v.clicks;
        
        IF _v.impressions > 0 THEN
            _current_conversion := (_v.clicks::numeric / _v.impressions::numeric);
            
            IF _current_conversion > _best_conversion THEN
                _best_conversion := _current_conversion;
                _winner_id := _v.id;
            END IF;
        END IF;
    END LOOP;

    -- Apply thresholds
    -- 1. Must have minimum total clicks
    -- 2. Best variant must be significantly better (implied by just picking best for now, 
    -- but we could add statistical significance later)
    IF _total_clicks >= COALESCE(_test.auto_winner_min_clicks, 100) THEN
        UPDATE public.ab_tests 
        SET winner_variant_id = _winner_id,
            status = 'active', -- Ensure it stays active but serves winner
            ended_at = now(),
            updated_at = now()
        WHERE id = p_test_id;
        
        RETURN _winner_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the increment function to trigger winner evaluation
CREATE OR REPLACE FUNCTION public.increment_ab_variant_stat(p_variant_id uuid, p_field text)
RETURNS void AS $$
DECLARE
    _test_id uuid;
BEGIN
    SELECT test_id INTO _test_id FROM public.ab_test_variants WHERE id = p_variant_id;

    IF p_field = 'impressions' THEN
        UPDATE public.ab_test_variants SET impressions = impressions + 1, updated_at = now() WHERE id = p_variant_id;
    ELSIF p_field = 'clicks' THEN
        UPDATE public.ab_test_variants SET clicks = clicks + 1, updated_at = now() WHERE id = p_variant_id;
        -- Evaluate winner after a click (conversion event)
        PERFORM public.ab_evaluate_winner(_test_id);
    ELSIF p_field = 'sales' THEN
        UPDATE public.ab_test_variants SET sales = sales + 1, updated_at = now() WHERE id = p_variant_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
