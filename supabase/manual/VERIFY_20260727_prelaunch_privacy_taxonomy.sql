-- Read-only verification for 20260727_prelaunch_privacy_taxonomy.sql.

SELECT 'unclaimed profiles are not public' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles claimed public read'
      AND qual ILIKE '%username%IS NOT NULL%'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles public read'
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'approved-only tried trigger exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.dish_tries'::regclass
      AND tgname = 'trg_dish_tries_approved' AND NOT tgisinternal
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'category pool-shape guard exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.categories'::regclass
      AND tgname = 'trg_categories_pool_shape' AND NOT tgisinternal
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'subtype pool-shape guard exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.dish_subtypes'::regclass
      AND tgname = 'trg_subtypes_pool_shape' AND NOT tgisinternal
  ) THEN 'OK' ELSE 'FAIL' END AS status;
