DROP POLICY IF EXISTS "follows authenticated read" ON public.follows;
REVOKE EXECUTE ON FUNCTION public.get_follow_counts(uuid) FROM PUBLIC, anon, authenticated;