DELETE FROM public.abandoned_carts 
WHERE length(coalesce(customer_name, '')) <= 1 
  AND customer_email IS NULL 
  AND customer_phone IS NULL;