-- Read-only verification for 20260727_atmospheric_category_photos.sql.

SELECT
  slug,
  name_en,
  CASE
    WHEN reference_photo_url IS NOT NULL
      AND btrim(reference_photo_url) <> ''
    THEN 'OK'
    ELSE 'FAIL'
  END AS status
FROM public.categories
WHERE slug IN ('pad-kra-pao', 'khao-soi', 'tom-yum')
ORDER BY slug;
