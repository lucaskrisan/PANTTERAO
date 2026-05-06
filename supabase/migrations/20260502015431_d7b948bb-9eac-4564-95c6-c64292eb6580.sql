ALTER TABLE public.cart_recovery_settings 
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_delay_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS whatsapp_message_template TEXT DEFAULT 'Olá {nome}! 🛒 Vi que você deixou alguns itens no carrinho. Use o cupom VOLTEJA para ganhar 10% de desconto e finalizar sua compra agora: {link}';