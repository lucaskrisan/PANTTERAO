ALTER TABLE public.pixel_events 
ADD COLUMN utm_source TEXT,
ADD COLUMN utm_medium TEXT,
ADD COLUMN utm_campaign TEXT,
ADD COLUMN utm_content TEXT,
ADD COLUMN utm_term TEXT;

-- Adicionando índice para busca por UTM se necessário
CREATE INDEX idx_pixel_events_utm_source ON public.pixel_events(utm_source);
CREATE INDEX idx_pixel_events_utm_medium ON public.pixel_events(utm_medium);