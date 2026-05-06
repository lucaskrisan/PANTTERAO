-- Habilitar Realtime para eventos e pedidos
-- Nota: Supabase Realtime respeita as políticas de RLS das tabelas.

DO $$
BEGIN
    -- Adicionar tabelas à publicação se não estiverem lá
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'pixel_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_events;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
END $$;

-- Garantir que o Realtime envie o payload completo (necessário para filtros e identificação no frontend)
ALTER TABLE public.pixel_events REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;