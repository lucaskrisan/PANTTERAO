CREATE TABLE public.billing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  credit_limit numeric NOT NULL DEFAULT 5,
  level integer NOT NULL DEFAULT 1,
  color text NOT NULL DEFAULT 'gray',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read billing tiers" ON public.billing_tiers
  FOR SELECT TO public USING (true);

CREATE POLICY "Super admins manage billing tiers" ON public.billing_tiers
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

INSERT INTO public.billing_tiers (key, label, credit_limit, level, color) VALUES
  ('iron',     'Iron',     5,    1, 'gray'),
  ('bronze',   'Bronze',   10,   2, 'amber'),
  ('silver',   'Silver',   20,   3, 'slate'),
  ('gold',     'Gold',     35,   4, 'yellow'),
  ('platinum', 'Platinum', 70,   5, 'cyan'),
  ('diamond',  'Diamond',  100,  6, 'violet')