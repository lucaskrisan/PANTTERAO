
CREATE TABLE public.sales_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  published boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own sales pages"
  ON public.sales_pages FOR ALL
  TO authenticated
  USING ((user_id = auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK ((user_id = auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Public read published sales pages"
  ON public.sales_pages FOR SELECT
  TO public
  USING (published = true);
