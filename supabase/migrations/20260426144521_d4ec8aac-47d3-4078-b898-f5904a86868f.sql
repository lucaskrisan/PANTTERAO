CREATE OR REPLACE FUNCTION public.expire_stale_pending_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pix_expired integer := 0;
  _stripe_failed integer := 0;
BEGIN
  -- PIX pendente > 30min => expired (QR Code já não funciona mais)
  WITH updated AS (
    UPDATE public.orders
    SET status = 'expired',
        updated_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'auto_expired_at', now(),
          'auto_expired_reason', 'pix_window_30min'
        )
    WHERE status = 'pending'
      AND payment_method = 'pix'
      AND created_at < now() - interval '30 minutes'
    RETURNING 1
  )
  SELECT count(*) INTO _pix_expired FROM updated;

  -- Cartão Stripe (external_id começa com 'pi_') pendente > 1h => failed
  WITH updated AS (
    UPDATE public.orders
    SET status = 'failed',
        updated_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'auto_failed_at', now(),
          'auto_failed_reason', 'stripe_orphan_1h'
        )
    WHERE status = 'pending'
      AND payment_method IN ('credit_card', 'card')
      AND external_id LIKE 'pi_%'
      AND created_at < now() - interval '1 hour'
    RETURNING 1
  )
  SELECT count(*) INTO _stripe_failed FROM updated;

  RETURN jsonb_build_object(
    'pix_expired', _pix_expired,
    'stripe_failed', _stripe_failed,
    'ran_at', now()
  );
END;
$$;