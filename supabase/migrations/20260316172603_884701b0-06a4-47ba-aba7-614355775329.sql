
-- ========================================
-- 1. BILLING_ACCOUNTS: Replace ALL policy with SELECT-only for users
-- ========================================
DROP POLICY IF EXISTS "Users manage own billing account" ON public.billing_accounts;

-- Users can only READ their own billing account
CREATE POLICY "Users read own billing account"
ON public.billing_accounts FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Only service_role (triggers/edge functions) can write
CREATE POLICY "Service role manages billing accounts"
ON public.billing_accounts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Super admins can manage all accounts
CREATE POLICY "Super admins manage billing accounts"
ON public.billing_accounts FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ========================================
-- 2. BILLING_TRANSACTIONS: Replace ALL policy with SELECT-only for users
-- ========================================
DROP POLICY IF EXISTS "Users manage own billing transactions" ON public.billing_transactions;

-- Users can only READ their own transactions
CREATE POLICY "Users read own billing transactions"
ON public.billing_transactions FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Only service_role can write
CREATE POLICY "Service role manages billing transactions"
ON public.billing_transactions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Super admins can manage all transactions
CREATE POLICY "Super admins manage billing transactions"
ON public.billing_transactions FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ========================================
-- 3. COUPONS: Restrict public SELECT to require product_id filter
-- ========================================
DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;

-- Public can only validate coupons by code (not enumerate all)
CREATE POLICY "Public validate active coupons by code"
ON public.coupons FOR SELECT
TO public
USING (active = true AND code = current_setting('request.headers', true)::json->>'x-coupon-code');

-- ========================================
-- 4. ABANDONED_CARTS: Prevent cross-producer spoofing
-- ========================================
DROP POLICY IF EXISTS "Public insert abandoned carts" ON public.abandoned_carts;

CREATE POLICY "Public insert abandoned carts safely"
ON public.abandoned_carts FOR INSERT
TO public
WITH CHECK (
  product_id IS NOT NULL 
  AND (user_id IS NULL OR user_id = (SELECT p.user_id FROM public.products p WHERE p.id = product_id))
);

-- ========================================
-- 5. PWA_SETTINGS: Restrict to active product owners
-- ========================================
DROP POLICY IF EXISTS "Public read pwa settings" ON public.pwa_settings;

CREATE POLICY "Public read pwa settings for active producers"
ON public.pwa_settings FOR SELECT
TO public
USING (user_id IN (SELECT p.user_id FROM public.products p WHERE p.active = true));
