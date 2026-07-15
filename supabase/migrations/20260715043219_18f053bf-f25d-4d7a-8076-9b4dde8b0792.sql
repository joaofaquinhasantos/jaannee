
CREATE POLICY "dish photos public read" ON storage.objects FOR SELECT USING (bucket_id = 'dish-photos');
CREATE POLICY "dish photos auth upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dish-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "dish photos owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dish-photos' AND owner = auth.uid());
CREATE POLICY "dish photos owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dish-photos' AND owner = auth.uid());
