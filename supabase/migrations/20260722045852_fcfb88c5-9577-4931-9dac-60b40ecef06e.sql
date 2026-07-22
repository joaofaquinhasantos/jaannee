
DROP POLICY IF EXISTS "follows authenticated read" ON public.follows;

CREATE POLICY "follows involving me read"
  ON public.follows FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE OR REPLACE FUNCTION public.get_follow_counts(_user_id uuid)
RETURNS TABLE(followers_count bigint, following_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.follows WHERE following_id = _user_id),
    (SELECT count(*) FROM public.follows WHERE follower_id = _user_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO anon, authenticated;
