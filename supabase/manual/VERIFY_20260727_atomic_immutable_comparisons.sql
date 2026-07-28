-- JaanNee atomic-comparison verification
-- READ-ONLY. Run after 20260727_atomic_immutable_comparisons.sql.
-- Every result must report OK before testing comparisons in the app.

SELECT 'RLS enabled on comparisons' AS check_name,
  CASE WHEN (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.comparisons'::regclass
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'authenticated comparison writes revoked' AS check_name,
  CASE WHEN
    NOT has_table_privilege('authenticated', 'public.comparisons', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.comparisons', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.comparisons', 'DELETE')
    AND has_table_privilege('authenticated', 'public.comparisons', 'SELECT')
  THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'owner-only SELECT policy installed' AS check_name,
  CASE WHEN
    EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'comparisons'
        AND policyname = 'comparisons owner select'
        AND cmd = 'SELECT'
        AND qual ILIKE '%auth.uid()%'
        AND qual ILIKE '%user_id%'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'comparisons'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    )
  THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'no duplicate diner/pair history' AS check_name,
  CASE WHEN NOT EXISTS (
    SELECT 1
    FROM public.comparisons
    GROUP BY user_id, dish_lo_id, dish_hi_id
    HAVING count(*) > 1
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'unique diner/pair index exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.comparisons'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND regexp_replace(pg_get_indexdef(i.indexrelid), '\s+', ' ', 'g')
          ILIKE '%(user_id, dish_lo_id, dish_hi_id)%'
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'canonical pair constraints exist' AS check_name,
  CASE WHEN
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.comparisons'::regclass
        AND conname = 'comparisons_ordered_pair_check'
        AND contype = 'c'
    )
    AND EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.comparisons'::regclass
        AND conname = 'comparisons_winner_in_pair_check'
        AND contype = 'c'
    )
  THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'immutable comparison trigger exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.comparisons'::regclass
      AND tgname = 'trg_comparisons_immutable'
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'atomic Elo trigger exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.comparisons'::regclass
      AND tgname = 'trg_comparisons_apply_elo'
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  ) THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'atomic RPC is SECURITY DEFINER and service-role only' AS check_name,
  CASE WHEN
    EXISTS (
      SELECT 1
      FROM pg_proc
      WHERE oid = 'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)'::regprocedure
        AND prosecdef
    )
    AND has_function_privilege(
      'service_role',
      'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)',
      'EXECUTE'
    )
    AND NOT has_function_privilege(
      'authenticated',
      'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)',
      'EXECUTE'
    )
    AND NOT has_function_privilege(
      'anon',
      'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)',
      'EXECUTE'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(
        COALESCE(p.proacl, acldefault('f', p.proowner))
      ) privilege_row
      WHERE p.oid =
        'public.submit_comparison_atomic(uuid,uuid,uuid,uuid)'::regprocedure
        AND privilege_row.grantee = 0
        AND privilege_row.privilege_type = 'EXECUTE'
    )
  THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'legacy apply_elo removed' AS check_name,
  CASE WHEN to_regprocedure(
    'public.apply_elo(uuid,uuid,uuid,uuid,boolean)'
  ) IS NULL THEN 'OK' ELSE 'FAIL' END AS status;

SELECT 'atomic RPC never rewrites comparison history' AS check_name,
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
