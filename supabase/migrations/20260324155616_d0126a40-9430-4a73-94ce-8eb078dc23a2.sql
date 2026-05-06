-- Fix sales_pages.slug unique constraint: allow same slug for different producers
ALTER TABLE public.sales_pages DROP CONSTRAINT IF EXISTS sales_pages_slug_key;
ALTER TABLE public.sales_pages ADD CONSTRAINT sales_pages_user_slug_unique UNIQUE (user_id, slug);