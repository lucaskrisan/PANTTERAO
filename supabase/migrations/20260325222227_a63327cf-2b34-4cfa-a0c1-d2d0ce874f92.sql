
-- Fix 1: Create member_access for Gisele Correa Mathias (order from 14/03 that didn't get access)
INSERT INTO public.member_access (customer_id, course_id, order_id)
VALUES (
  '6a994837-b67d-4920-aa56-605206714956',
  '47e9e174-1d88-4fca-886e-91e433acc578',
  '966b2104-5568-4152-ba23-a74d057131de'
);

-- Fix 2: Correct Elidiane's email from gmail.come → gmail.com
UPDATE public.customers
SET email = 'elidiane.cris2@gmail.com', updated_at = now()
WHERE id = '1b655e4b-013c-4725-98a1-9cfaa4b5b510'
  AND email = 'elidiane.cris2@gmail.come';
