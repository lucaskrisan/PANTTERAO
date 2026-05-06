-- Fix: Allow producers to read their own internal_tasks so gateway_error alerts
-- appear on their dashboard. Previously only super admins could read internal_tasks,
-- causing GatewayAlerts to always return empty for regular producers.
CREATE POLICY "Users can read own internal tasks"
ON public.internal_tasks
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
