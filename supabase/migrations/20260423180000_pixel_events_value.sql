-- Add event_value to pixel_events for Purchase amount display in live feed
ALTER TABLE public.pixel_events ADD COLUMN IF NOT EXISTS event_value numeric DEFAULT NULL;
