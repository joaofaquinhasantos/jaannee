-- Read-only verification for supabase/manual/20260725_integrity_hardening.sql.
-- Run in the Supabase SQL editor. Every result should read 'OK'.
-- No \psql commands. Safe to run at any time.

-- 1. Live row counts (informational, not modified)
SELECT 'row counts' AS check,
  (SELECT count(*) FROM public.dishes)      AS dishes,
  (SELECT count(*) FROM public.comparisons) AS comparisons,
  (SELECT count(*) FROM public.dish_tries)  AS tried_marks,
  (SELECT count(*) FROM public.dish_subtypes) AS subtypes,
  (SELECT count(*) FROM public.categories WHERE requires_subtype) AS required_flag;

-- 2. requires_subtype column exists
SELECT 'requires_subtype column' AS check,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='categories' AND column_name='requires_subtype')
    THEN 'OK' ELSE 'MISSING' END AS status;

-- 3. Seven approved categories are flagged
SELECT 'seven flagged categories' AS check,
  CASE WHEN (
    SELECT count(*) FROM public.categories
     WHERE requires_subtype
       AND slug IN ('sushi','dim-sum','tapas','korean-bbq','steak','specialty-coffee','matcha')
  ) = 7 THEN 'OK' ELSE 'MISSING FLAGS' END AS status;

-- 4. Every expected subtype slug is present and active
WITH expected(cat_slug, sub_slug, ord) AS (
  VALUES
    ('sushi','nigiri',10),('sushi','maki-roll',20),('sushi','temaki',30),('sushi','chirashi',40),
    ('dim-sum','har-gow',10),('dim-sum','siu-mai',20),('dim-sum','char-siu-bao',30),('dim-sum','xiao-long-bao',40),
    ('tapas','patatas-bravas',10),('tapas','croquetas',20),('tapas','gambas-al-ajillo',30),('tapas','tortilla-espanola',40),
    ('korean-bbq','samgyeopsal',10),('korean-bbq','galbi',20),('korean-bbq','bulgogi',30),
    ('steak','ribeye',10),('steak','sirloin',20),('steak','tenderloin',30),
    ('specialty-coffee','espresso',10),('specialty-coffee','flat-white',20),('specialty-coffee','cappuccino',30),
    ('specialty-coffee','pour-over',40),('specialty-coffee','cold-brew',50),
    ('matcha','usucha',10),('matcha','matcha-latte',20),('matcha','matcha-tonic',30)
)
SELECT 'subtype seeds present + active + ordered' AS check,
  CASE WHEN (
    SELECT count(*) FROM expected e
      LEFT JOIN public.categories c ON c.slug = e.cat_slug
      LEFT JOIN public.dish_subtypes s ON s.category_id = c.id AND s.slug = e.sub_slug
     WHERE s.id IS NULL OR s.is_active = false OR s.display_order <> e.ord
  ) = 0 THEN 'OK' ELSE 'MISSING/INACTIVE/BAD ORDER' END AS status;

-- 5. Tried trigger runs on all UPDATEs (not just user_id/dish_lo_id/dish_hi_id)
SELECT 'trg_comparisons_tried fires on winner updates' AS check,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname='trg_comparisons_tried'
       AND tgattr = ''::pg_catalog.int2vector    -- empty = all columns
  ) THEN 'OK' ELSE 'COLUMN-LIMITED — winner-only edits bypass' END AS status;

-- 6. Ranking-key uses requires_subtype
SELECT 'dish_ranking_key considers requires_subtype' AS check,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
     WHERE n.nspname='public' AND p.proname='dish_ranking_key'
       AND pg_get_functiondef(p.oid) LIKE '%category_is_subtype_scoped%'
  ) THEN 'OK' ELSE 'STALE DEFINITION' END AS status;

-- 7. Safe merge: no comparison UPDATE/DELETE, validates place_id
SELECT 'admin_merge_dishes is safe (no comparison writes, validates place)' AS check,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
     WHERE n.nspname='public' AND p.proname='admin_merge_dishes'
       AND pg_get_functiondef(p.oid) NOT ILIKE '%UPDATE public.comparisons%'
       AND pg_get_functiondef(p.oid) NOT ILIKE '%DELETE FROM public.comparisons%'
       AND pg_get_functiondef(p.oid) ILIKE '%same place%'
  ) THEN 'OK' ELSE 'UNSAFE — still writes comparisons or missing place check' END AS status;

-- 8. Merge grants: service_role only
SELECT 'admin_merge_dishes grants (service_role only)' AS check,
  CASE WHEN NOT has_function_privilege('anon',          'public.admin_merge_dishes(uuid,uuid)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.admin_merge_dishes(uuid,uuid)', 'EXECUTE')
        AND     has_function_privilege('service_role',  'public.admin_merge_dishes(uuid,uuid)', 'EXECUTE')
       THEN 'OK' ELSE 'BAD GRANTS' END AS status;

-- 9. Delete guard exists
SELECT 'trg_dishes_delete_guard' AS check,
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_dishes_delete_guard')
       THEN 'OK' ELSE 'MISSING' END AS status;

-- 10. normalize_dish_name trims and collapses whitespace
SELECT 'normalize_dish_name trim + collapse' AS check,
  CASE WHEN public.normalize_dish_name('  Pad   Thai  ') = 'pad thai'
   AND public.normalize_dish_name('PAD THAI') = 'pad thai'
       THEN 'OK' ELSE 'STALE NORMALISATION' END AS status;

-- 11. Unique-index rebuilt with corrected function and rejected predicate
SELECT 'dishes_unique_name_per_place index' AS check,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND indexname='dishes_unique_name_per_place'
       AND indexdef ILIKE '%normalize_dish_name%'
       AND indexdef ILIKE '%status <> ''rejected''%'
  ) THEN 'OK' ELSE 'MISSING OR STALE' END AS status;

-- 12. Storage bucket restrictions
SELECT 'dish-photos bucket 8MB + JPEG/PNG/WebP + private' AS check,
  CASE WHEN EXISTS (
    SELECT 1 FROM storage.buckets
     WHERE id='dish-photos'
       AND file_size_limit = 8388608
       AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
       AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]
       AND public = false
  ) THEN 'OK' ELSE 'BUCKET NOT LOCKED DOWN' END AS status;

-- 13. nearby_places has 4-argument signature
SELECT 'nearby_places(_lat,_lng,_radius_km,_max_results)' AS check,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
     WHERE n.nspname='public' AND p.proname='nearby_places'
       AND pg_get_function_identity_arguments(p.oid) =
           '_lat double precision, _lng double precision, _radius_km double precision, _max_results integer'
  ) THEN 'OK' ELSE 'MISSING 4-ARG SIGNATURE' END AS status;

-- 14. nearby_places grants: service_role only
SELECT 'nearby_places grants (service_role only)' AS check,
  CASE WHEN NOT has_function_privilege('anon',          'public.nearby_places(double precision,double precision,double precision,integer)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.nearby_places(double precision,double precision,double precision,integer)', 'EXECUTE')
        AND     has_function_privilege('service_role',  'public.nearby_places(double precision,double precision,double precision,integer)', 'EXECUTE')
       THEN 'OK' ELSE 'BAD GRANTS' END AS status;

-- 15. RLS remains enabled on core tables
SELECT 'RLS enabled on core tables' AS check,
  CASE WHEN (
    SELECT bool_and(relrowsecurity) FROM pg_class
     WHERE relname IN ('dishes','comparisons','dish_tries','places','reports','follows','user_roles','profiles')
       AND relnamespace = 'public'::regnamespace
  ) THEN 'OK' ELSE 'RLS OFF ON SOMETHING' END AS status;

-- 16. Sensitive SECURITY DEFINER functions not exposed to normal users
SELECT 'apply_elo / get_dish_tried_counts / get_follow_counts locked down' AS check,
  CASE WHEN NOT has_function_privilege('authenticated','public.apply_elo(uuid,uuid,uuid,uuid,boolean)','EXECUTE')
        AND NOT has_function_privilege('authenticated','public.get_dish_tried_counts(uuid[])','EXECUTE')
        AND NOT has_function_privilege('authenticated','public.get_follow_counts(uuid)','EXECUTE')
       THEN 'OK' ELSE 'LEAK' END AS status;
