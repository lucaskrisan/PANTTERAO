-- Add user_id column to suppressed_emails for multi-tenant isolation
ALTER TABLE public.suppressed_emails
ADD COLUMN user_id uuid;

-- Create index for efficient tenant-scoped queries
CREATE INDEX idx_suppressed_emails_user_id ON public.suppressed_emails (user_id);

-- Allow producers to view their own suppressed emails
CREATE POLICY "Producers read own suppressed emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));