-- Fix search_path on trigger fn
CREATE OR REPLACE FUNCTION public.update_ab_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Lock down execution: only service role calls these
REVOKE EXECUTE ON FUNCTION public.ab_pick_variant(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ab_record_conversion(text, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ab_evaluate_winner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ab_evaluate_winner(uuid) TO authenticated;