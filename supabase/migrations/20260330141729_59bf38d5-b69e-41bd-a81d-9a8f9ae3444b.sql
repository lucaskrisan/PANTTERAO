
-- Fix Realtime: remove tables and re-add (IF EXISTS not supported for DROP TABLE in publications)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.pixel_events;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END$$;

-- Re-add with RLS enforced
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_events;
