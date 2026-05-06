
-- Order bumps table
CREATE TABLE public.order_bumps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  bump_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT 'Adicionar a compra',
  call_to_action TEXT NOT NULL DEFAULT 'Sim, eu aceito essa oferta especial!',
  use_product_image BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.order_bumps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers manage own order bumps"
ON public.order_bumps
FOR ALL
TO authenticated
USING ((user_id = auth.uid()) OR is_super_admin(auth.uid()))
WITH CHECK ((user_id = auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Public read order bumps"
ON public.order_bumps
FOR SELECT
TO public
USING (active = true);
