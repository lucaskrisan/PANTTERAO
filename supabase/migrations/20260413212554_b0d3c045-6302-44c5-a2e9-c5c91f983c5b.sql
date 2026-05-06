-- Drop the overly broad UPDATE policy
DROP POLICY IF EXISTS "Users can update own auto-recharge settings" ON public.billing_accounts;

-- Create a column-restricted UPDATE policy
-- Users can only update auto-recharge settings; financial fields must remain unchanged
CREATE POLICY "Users can update own auto-recharge settings"
ON public.billing_accounts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND balance IS NOT DISTINCT FROM (SELECT ba.balance FROM public.billing_accounts ba WHERE ba.user_id = auth.uid())
  AND credit_limit IS NOT DISTINCT FROM (SELECT ba.credit_limit FROM public.billing_accounts ba WHERE ba.user_id = auth.uid())
  AND credit_tier IS NOT DISTINCT FROM (SELECT ba.credit_tier FROM public.billing_accounts ba WHERE ba.user_id = auth.uid())
  AND blocked IS NOT DISTINCT FROM (SELECT ba.blocked FROM public.billing_accounts ba WHERE ba.user_id = auth.uid())
  AND card_token IS NOT DISTINCT FROM (SELECT ba.card_token FROM public.billing_accounts ba WHERE ba.user_id = auth.uid())
  AND card_last4 IS NOT DISTINCT FROM (SELECT ba.card_last4 FROM public.billing_accounts ba WHERE ba.user_id = auth.uid())
  AND card_brand IS NOT DISTINCT FROM (SELECT ba.card_brand FROM public.billing_accounts ba WHERE ba.user_id = auth.uid())
);