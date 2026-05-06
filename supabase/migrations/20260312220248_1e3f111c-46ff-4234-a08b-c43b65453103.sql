
ALTER TABLE public.email_logs 
  ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN opened_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN clicked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN bounced_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN bounce_reason TEXT;

CREATE INDEX idx_email_logs_resend_id ON public.email_logs(resend_id);
