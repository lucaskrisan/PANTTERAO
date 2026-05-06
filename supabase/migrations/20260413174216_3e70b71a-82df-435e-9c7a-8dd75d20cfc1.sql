-- Drop the old 6-param version, keep only the 7-param version
DROP FUNCTION IF EXISTS public.update_abandoned_cart(uuid, text, text, text, text, text);
