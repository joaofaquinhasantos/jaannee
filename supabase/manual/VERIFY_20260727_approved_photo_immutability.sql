-- Read-only verification for 20260727_approved_photo_immutability.sql.

SELECT 'dish photos have no public storage read policy' AS check_name,
  CASE WHEN NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND roles @> ARRAY['public']::name[]
      AND qual ILIKE '%dish-photos%'
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'authenticated storage object updates blocked' AS check_name,
  CASE WHEN NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'UPDATE'
      AND roles @> ARRAY['authenticated']::name[]
      AND (qual ILIKE '%dish-photos%' OR with_check ILIKE '%dish-photos%')
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'approved dish photos protected from owner deletion' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'dish photos owner delete unapproved only'
      AND cmd = 'DELETE'
      AND qual ILIKE '%status%approved%'
      AND qual ILIKE '%photo_url%'
      AND qual ILIKE '%storage.objects.name%'
  ) THEN 'OK' ELSE 'FAIL' END AS status;
