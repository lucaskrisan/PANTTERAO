
DROP POLICY "Service role can insert EMQ snapshots" ON public.emq_snapshots;

CREATE POLICY "Service role insert EMQ snapshots"
ON public.emq_snapshots FOR INSERT TO service_role
WITH CHECK (true);
