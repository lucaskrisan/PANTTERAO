
-- Create storage bucket for course materials (PDFs, files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-materials', 'course-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Admins upload course materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow authenticated admins to delete files
CREATE POLICY "Admins delete course materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow public read access
CREATE POLICY "Public read course materials"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-materials');
