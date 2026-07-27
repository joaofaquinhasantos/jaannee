-- Read-only verification. Run after 20260727_atomic_immutable_comparisons.sql.

SELECT 'authenticated comparison writes revoked' AS check_name,
  CASE WHEN NOT has_table_privilege('authenticated', 'public.comparisons', 'INSERT')
         AND NOT has_table_privilege('authenticated', 'public.comparisons', 'UPDATE')
         AND NOT has_table_privilege('authenticated', 'public.comparisons', 'DELETE')
       THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'comparison write policies removed' AS check_name,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comparisons'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'immutable comparison trigger exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.comparisons'::regclass
      AND tgname = 'trg_comparisons_immutable' AND NOT tgisinternal
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'atomic Elo trigger exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.comparisons'::regclass
      AND tgname = 'trg_comparisons_apply_elo' AND NOT tgisinternal
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'atomic RPC is service-role only' AS check_name,
  CASE WHEN
    has_function_privilege('service_role',
      'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated',
      'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon',
      'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)', 'EXECUTE')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
      WHERE p.oid =
        'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)'::regprocedure
        AND a.grantee = 0
        AND a.privilege_type = 'EXECUTE'
    )
  THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'legacy apply_elo removed' AS check_name,
  CASE WHEN to_regprocedure(
    'public.apply_elo(uuid,uuid,uuid,uuid,boolean)'
  ) IS NULL THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'atomic RPC only inserts comparison history' AS check_name,
  CASE WHEN
    pg_get_functiondef(
      'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)'::regprocedure
    ) ILIKE '%INSERT INTO public.comparisons%'
    AND pg_get_functiondef(
      'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)'::regprocedure
    ) NOT ILIKE '%UPDATE public.comparisons%'
    AND pg_get_functiondef(
      'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)'::regprocedure
    ) NOT ILIKE '%DELETE FROM public.comparisons%'
  THEN 'OK' ELSE 'FAIL' END AS status;
