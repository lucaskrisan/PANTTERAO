
ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS auto_recharge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_recharge_amount numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS auto_recharge_threshold numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS last_auto_recharge_at timestamptz DEFAULT NULL;
