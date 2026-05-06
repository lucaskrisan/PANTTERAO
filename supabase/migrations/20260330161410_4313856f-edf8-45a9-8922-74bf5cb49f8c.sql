
-- 1. Enable RLS on active_gateways view (it's already a view, but we need to restrict access)
-- Recreate active_gateways as a security_invoker view with RLS policy
DROP VIEW IF EXISTS public.active_gateways;
CREATE VIEW public.active_gateways WITH (security_invoker = true) AS
SELECT id, name, provider, environment, payment_methods, user_id
FROM public.payment_gateways
WHERE active = true;

-- 2. Remove orders and pixel_events from Realtime publication
DO $$
DECLARE
  _tbl text;
BEGIN
  FOR _tbl IN
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename IN ('orders', 'pixel_events')
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', _tbl);
  END LOOP;
END;
$$;
