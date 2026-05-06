ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_events;
ALTER TABLE public.pixel_events REPLICA IDENTITY FULL;