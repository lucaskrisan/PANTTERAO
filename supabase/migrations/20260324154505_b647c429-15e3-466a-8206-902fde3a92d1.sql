
-- FIX #0: Remove privilege escalation trigger
DROP TRIGGER IF EXISTS on_profile_complete_promote ON public.profiles;
DROP FUNCTION IF EXISTS public.promote_to_admin_on_profile_complete();

-- FIX #1: Add critical indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_external_id ON public.orders (external_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id_status ON public.orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON public.orders (product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers (email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON public.customers (cpf);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers (user_id);

CREATE INDEX IF NOT EXISTS idx_fraud_blacklist_value_type ON public.fraud_blacklist (value, type);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_user_id ON public.billing_accounts (user_id);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_user_id_created ON public.billing_transactions (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_member_access_customer_id ON public.member_access (customer_id);
CREATE INDEX IF NOT EXISTS idx_member_access_access_token ON public.member_access (access_token);
CREATE INDEX IF NOT EXISTS idx_member_access_course_id ON public.member_access (course_id);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user_id ON public.abandoned_carts (user_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovered ON public.abandoned_carts (recovered);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products (user_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products (active);
