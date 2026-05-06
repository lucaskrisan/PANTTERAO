-- Fix: pixel_events public INSERT policy - validate user_id matches product owner
DROP POLICY IF EXISTS "Public insert events" ON public.pixel_events;

CREATE POLICY "Public insert events"
ON public.pixel_events
FOR INSERT
TO public
WITH CHECK (
  product_id IS NOT NULL
  AND event_name IS NOT NULL
  AND (
    user_id IS NULL
    OR user_id = (SELECT p.user_id FROM public.products p WHERE p.id = pixel_events.product_id)
  )
);