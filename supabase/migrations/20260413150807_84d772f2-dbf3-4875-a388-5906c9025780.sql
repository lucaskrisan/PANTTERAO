
-- Add customizable email template fields to cart_recovery_settings
ALTER TABLE public.cart_recovery_settings
  ADD COLUMN IF NOT EXISTS email_subject text DEFAULT 'Você esqueceu algo no carrinho 🛒',
  ADD COLUMN IF NOT EXISTS email_heading text DEFAULT 'Você esqueceu algo no carrinho 🛒',
  ADD COLUMN IF NOT EXISTS email_button_text text DEFAULT 'Finalizar compra →',
  ADD COLUMN IF NOT EXISTS email_button_color text DEFAULT '#22c55e',
  ADD COLUMN IF NOT EXISTS second_email_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS second_email_delay_hours integer DEFAULT 24;

-- Add reminder count to track how many emails were sent per cart
ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS email_reminder_count integer DEFAULT 0;
