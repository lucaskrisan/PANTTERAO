-- Add filtering and quiet hours columns
ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS product_whitelist UUID[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '08:00';

COMMENT ON COLUMN public.notification_settings.product_whitelist IS 'Lista de IDs de produtos para filtrar notificações (null = todos)';
COMMENT ON COLUMN public.notification_settings.quiet_hours_enabled IS 'Habilita horário de silêncio para notificações';
