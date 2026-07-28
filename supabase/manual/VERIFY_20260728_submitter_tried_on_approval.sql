-- Read-only verification for 20260728_submitter_tried_on_approval.sql

SELECT
  'approval trigger exists' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_mark_submitter_tried_on_approval'
      AND NOT tgisinternal
  ) THEN 'OK' ELSE 'MISSING' END AS result;

SELECT
  'trigger function is security definer' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mark_submitter_tried_on_approval'
      AND p.prosecdef
  ) THEN 'OK' ELSE 'MISSING' END AS result;

SELECT
  'normal users cannot execute trigger function' AS check_name,
  CASE WHEN
    NOT has_function_privilege(
      'anon',
      'public.mark_submitter_tried_on_approval()',
      'EXECUTE'
    )
    AND NOT has_function_privilege(
      'authenticated',
      'public.mark_submitter_tried_on_approval()',
      'EXECUTE'
    )
  THEN 'OK' ELSE 'CHECK GRANTS' END AS result;

SELECT
  'approved submissions have submitter tried marks' AS check_name,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'MISSING TRIED MARKS: ' || count(*) END AS result
FROM public.dishes d
WHERE d.status = 'approved'
  AND d.submitted_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.dish_tries dt
    WHERE dt.user_id = d.submitted_by
      AND dt.dish_id = d.id
  );
