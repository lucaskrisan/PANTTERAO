CREATE TABLE public.payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    function_name TEXT NOT NULL,
    level TEXT DEFAULT 'info',
    message TEXT,
    payload JSONB,
    error JSONB,
    user_id UUID,
    product_id UUID,
    customer_email TEXT
);

-- Enable RLS
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Allow insert from anon (edge functions use service role anyway, but just in case)
CREATE POLICY "Allow system logging" ON public.payment_logs FOR INSERT WITH CHECK (true);

-- Allow admins to view logs
CREATE POLICY "Admins can view logs" ON public.payment_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND role = 'super_admin'
  )
);