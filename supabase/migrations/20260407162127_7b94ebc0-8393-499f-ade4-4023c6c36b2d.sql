-- Allow producers to update their own billing account settings (auto-recharge config)
CREATE POLICY "Users update own billing account"
ON public.billing_accounts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());