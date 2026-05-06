UPDATE public.payment_gateways 
SET environment = 'production', updated_at = now() 
WHERE user_id = 'c5d2095f-ad44-4884-91c3-89c0b73c5af2' 
AND environment = 'sandbox';