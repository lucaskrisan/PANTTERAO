CREATE POLICY "Producers view own internal tasks"
ON public.internal_tasks
FOR SELECT
TO authenticated
USING (user_id = auth.uid());