
CREATE TABLE public.fraud_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('cpf', 'email')),
  value text NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, value)
);

ALTER TABLE public.fraud_blacklist ENABLE ROW LEVEL SECURITY;

-- Only admins and super_admins can manage blacklist
CREATE POLICY "Admins manage blacklist"
  ON public.fraud_blacklist
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));
