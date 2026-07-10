INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes',
  'comprovantes',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "comprovantes_upload" ON storage.objects;
CREATE POLICY "comprovantes_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes'
    AND (storage.foldername(name))[1] IN (
      SELECT empresa_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "comprovantes_read" ON storage.objects;
CREATE POLICY "comprovantes_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes'
    AND (storage.foldername(name))[1] IN (
      SELECT empresa_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "comprovantes_delete" ON storage.objects;
CREATE POLICY "comprovantes_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes'
    AND (storage.foldername(name))[1] IN (
      SELECT empresa_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );
