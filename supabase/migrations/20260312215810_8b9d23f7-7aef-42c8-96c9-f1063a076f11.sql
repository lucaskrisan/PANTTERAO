
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  html_body TEXT,
  email_type TEXT NOT NULL DEFAULT 'transactional',
  status TEXT NOT NULL DEFAULT 'sent',
  resend_id TEXT,
  order_id UUID,
  customer_id UUID,
  product_id UUID,
  source TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  cost_estimate NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own email logs"
ON public.email_logs
FOR ALL
TO authenticated
USING ((user_id = auth.uid()) OR is_super_admin(auth.uid()))
WITH CHECK ((user_id = auth.uid()) OR is_super_admin(auth.uid()));

CREATE INDEX idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_email_type ON public.email_logs(email_type);
