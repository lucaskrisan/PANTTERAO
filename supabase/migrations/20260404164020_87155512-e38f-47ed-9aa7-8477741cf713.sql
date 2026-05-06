CREATE POLICY "Service role can read fraud blacklist"
ON public.fraud_blacklist
FOR SELECT
TO service_role
USING (true);