-- Invariant checks. Every row should report 'OK'.
\pset format aligned

SELECT 'requires_subtype column' AS check,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='categories' AND column_name='requires_subtype')
       THEN 'OK' ELSE 'MISSING' END AS status;

SELECT 'trg_dishes_approval_subtype' AS check,
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_dishes_approval_subtype') THEN 'OK' ELSE 'MISSING' END;

SELECT 'trg_comparisons_tried' AS check,
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_comparisons_tried') THEN 'OK' ELSE 'MISSING' END;

SELECT 'trg_dishes_delete_guard' AS check,
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_dishes_delete_guard') THEN 'OK' ELSE 'MISSING' END;

SELECT 'admin_merge_dishes function' AS check,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
                    WHERE n.nspname='public' AND p.proname='admin_merge_dishes') THEN 'OK' ELSE 'MISSING' END;

SELECT 'nearby_places function' AS check,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
                    WHERE n.nspname='public' AND p.proname='nearby_places') THEN 'OK' ELSE 'MISSING' END;

SELECT 'dishes_unique_name_per_place index' AS check,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='dishes_unique_name_per_place')
       THEN 'OK' ELSE 'MISSING' END;

-- apply_elo must be service_role only
SELECT 'apply_elo is service_role-only' AS check,
  CASE WHEN NOT has_function_privilege('anon', 'public.apply_elo(uuid,uuid,uuid,uuid,boolean)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.apply_elo(uuid,uuid,uuid,uuid,boolean)', 'EXECUTE')
       THEN 'OK' ELSE 'PUBLIC EXECUTE LEAKED' END;
