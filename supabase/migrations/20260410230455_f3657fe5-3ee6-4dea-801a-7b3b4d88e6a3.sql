UPDATE public.abandoned_carts ac
SET recovered = true
WHERE ac.recovered = false
  AND EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE c.email = ac.customer_email
      AND o.product_id = ac.product_id
      AND o.status IN ('paid', 'approved')
  );