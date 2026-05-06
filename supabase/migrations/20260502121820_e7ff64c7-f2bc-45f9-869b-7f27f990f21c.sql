-- Add new notification control columns
ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS whatsapp_pix_reminder BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_pix_reminder BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS send_abandoned_cart BOOLEAN NOT NULL DEFAULT true;

-- Update RLS policies to ensure users can access new columns (existing policies should cover this but let's be safe)
COMMENT ON COLUMN public.notification_settings.whatsapp_pix_reminder IS 'Envia lembrete de PIX via WhatsApp';
COMMENT ON COLUMN public.notification_settings.email_pix_reminder IS 'Envia lembrete de PIX via Email';
COMMENT ON COLUMN public.notification_settings.send_abandoned_cart IS 'Envia notificação push de carrinho abandonado';
