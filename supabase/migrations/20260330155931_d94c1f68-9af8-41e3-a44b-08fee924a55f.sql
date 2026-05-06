
-- 3. Disable Realtime on sensitive tables
-- Use DO block to safely drop tables from publication only if they exist in it
DO $$
DECLARE
  _tbl text;
BEGIN
  FOR _tbl IN
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename IN ('payment_gateways','product_pixels','billing_accounts','billing_transactions','fraud_blacklist','webhook_endpoints','profiles')
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', _tbl);
  END LOOP;
END;
$$;
