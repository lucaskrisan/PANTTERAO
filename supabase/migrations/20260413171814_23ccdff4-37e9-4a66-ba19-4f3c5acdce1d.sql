SELECT cron.schedule(
  'reconcile-abandoned-carts',
  '*/30 * * * *',
  $$SELECT public.reconcile_abandoned_carts()$$
);