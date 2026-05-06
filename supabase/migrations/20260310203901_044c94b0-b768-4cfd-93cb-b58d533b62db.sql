
CREATE TABLE public.facebook_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own facebook domains"
  ON public.facebook_domains FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));
