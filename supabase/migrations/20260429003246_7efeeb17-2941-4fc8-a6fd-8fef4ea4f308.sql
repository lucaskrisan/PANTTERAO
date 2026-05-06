CREATE OR REPLACE FUNCTION public.get_latest_pixel_events_per_product()
RETURNS TABLE (product_id UUID, latest_event TIMESTAMPTZ) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT pe.product_id, MAX(pe.created_at) as latest_event
    FROM public.pixel_events pe
    WHERE pe.created_at > now() - interval '24 hours'
    GROUP BY pe.product_id;
END;
$$;