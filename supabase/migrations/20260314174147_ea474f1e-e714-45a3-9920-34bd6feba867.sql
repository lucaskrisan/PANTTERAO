
-- Upsell offers configuration table
CREATE TABLE public.upsell_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  upsell_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT 'Oferta especial por tempo limitado!',
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (product_id, upsell_product_id)
);

-- Enable RLS
ALTER TABLE public.upsell_offers ENABLE ROW LEVEL SECURITY;

-- Producers manage own upsell offers
CREATE POLICY "Producers manage own upsell offers"
  ON public.upsell_offers FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Public read active upsell offers (checkout needs this)
CREATE POLICY "Public read active upsell offers"
  ON public.upsell_offers FOR SELECT TO public
  USING (active = true);
