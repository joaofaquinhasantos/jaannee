-- Read-only verification for 20260728_immediate_public_posts.sql

SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('dishes', 'places')
  AND policyname IN ('dishes public read published', 'places_select_published')
ORDER BY tablename, policyname;

SELECT
  count(*) FILTER (WHERE status = 'pending') AS pending_dishes,
  count(*) FILTER (WHERE status = 'approved') AS approved_dishes,
  count(*) FILTER (WHERE status = 'rejected') AS rejected_dishes
FROM public.dishes;

