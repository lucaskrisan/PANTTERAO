INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read email-assets' AND tablename = 'objects') THEN
    CREATE POLICY "Public read email-assets" ON storage.objects FOR SELECT USING (bucket_id = 'email-assets');
  END IF;
END $$;