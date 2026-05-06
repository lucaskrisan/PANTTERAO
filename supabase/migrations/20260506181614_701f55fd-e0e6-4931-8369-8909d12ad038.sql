-- Fix RLS for orders: allow collaborators to see unclaimed PIX and their own attributed orders
CREATE POLICY "Collaborators can view marketplace orders"
  ON public.orders FOR SELECT
  USING (
    has_role(auth.uid(), 'collaborator') AND (
      (
        payment_method = 'pix' AND 
        status IN ('pending', 'expired') AND 
        created_at > now() - interval '72 hours' AND
        NOT EXISTS (
          SELECT 1 FROM public.recovery_opportunities ro 
          WHERE ro.reference_id = orders.id AND ro.type = 'pix' AND ro.status IN ('claimed', 'contacted')
        )
      ) OR (
        collaborator_id = auth.uid()
      )
    )
  );

-- Fix RLS for abandoned_carts: allow collaborators to see unclaimed carts and their own claims
CREATE POLICY "Collaborators can view marketplace abandoned carts"
  ON public.abandoned_carts FOR SELECT
  USING (
    has_role(auth.uid(), 'collaborator') AND (
      (
        recovered = false AND 
        created_at > now() - interval '7 days' AND
        NOT EXISTS (
          SELECT 1 FROM public.recovery_opportunities ro 
          WHERE ro.reference_id = abandoned_carts.id AND ro.type = 'abandoned_cart' AND ro.status IN ('claimed', 'contacted')
        )
      ) OR (
        EXISTS (
          SELECT 1 FROM public.recovery_opportunities ro
          WHERE ro.reference_id = abandoned_carts.id AND ro.type = 'abandoned_cart' AND ro.collaborator_id = auth.uid()
        )
      )
    )
  );

-- Fix RLS for customers: allow collaborators to see customers linked to leads
CREATE POLICY "Collaborators can view marketplace customers"
  ON public.customers FOR SELECT
  USING (
    has_role(auth.uid(), 'collaborator') AND (
      EXISTS (
        SELECT 1 FROM public.orders o 
        WHERE o.customer_id = customers.id AND (
           (o.payment_method = 'pix' AND o.status IN ('pending', 'expired')) OR o.collaborator_id = auth.uid()
        )
      ) OR
      EXISTS (
        SELECT 1 FROM public.abandoned_carts ac
        WHERE ac.customer_email = customers.email AND ac.recovered = false
      )
    )
  );

-- Allow collaborators to see all active products for reference
CREATE POLICY "Collaborators can view all active products"
  ON public.products FOR SELECT
  USING (
    has_role(auth.uid(), 'collaborator') AND 
    active = true
  );
