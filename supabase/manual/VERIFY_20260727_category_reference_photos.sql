-- Read-only verification for 20260727_category_reference_photos.sql.

SELECT 'category reference photo column exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categories'
      AND column_name = 'reference_photo_url'
      AND data_type = 'text'
  ) THEN 'OK' ELSE 'FAIL' END AS status;
