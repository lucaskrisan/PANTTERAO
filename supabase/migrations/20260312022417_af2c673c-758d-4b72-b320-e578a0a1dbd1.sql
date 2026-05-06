
-- Coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  max_uses integer DEFAULT NULL,
  used_count integer NOT NULL DEFAULT 0,
  min_amount numeric DEFAULT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE DEFAULT NULL,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz DEFAULT NULL,
  user_id uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX coupons_code_user_idx ON public.coupons (LOWER(code), user_id);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Public read active coupons" ON public.coupons
  FOR SELECT TO public
  USING (active = true);

-- Abandoned carts table
CREATE TABLE public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  customer_name text DEFAULT NULL,
  customer_email text DEFAULT NULL,
  customer_phone text DEFAULT NULL,
  customer_cpf text DEFAULT NULL,
  payment_method text DEFAULT NULL,
  utm_source text DEFAULT NULL,
  utm_medium text DEFAULT NULL,
  utm_campaign text DEFAULT NULL,
  recovered boolean NOT NULL DEFAULT false,
  user_id uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert abandoned carts" ON public.abandoned_carts
  FOR INSERT TO public
  WITH CHECK (product_id IS NOT NULL);

CREATE POLICY "Producers manage own abandoned carts" ON public.abandoned_carts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));
