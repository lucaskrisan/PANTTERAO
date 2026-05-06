
ALTER TABLE public.whatsapp_send_log
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS external_message_id text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_log_ext_msg_id 
  ON public.whatsapp_send_log (external_message_id) 
  WHERE external_message_id IS NOT NULL;
