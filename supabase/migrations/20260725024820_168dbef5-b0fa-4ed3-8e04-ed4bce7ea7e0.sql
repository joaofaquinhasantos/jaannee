-- Restrict raw reads on comparisons
DROP POLICY IF EXISTS "comparisons public read" ON public.comparisons;
CREATE POLICY "comparisons owner read"
  ON public.comparisons
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
REVOKE SELECT ON public.comparisons FROM anon;

-- Restrict raw reads on dish_tries
DROP POLICY IF EXISTS "tries public read" ON public.dish_tries;
CREATE POLICY "tries owner read"
  ON public.dish_tries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
REVOKE SELECT ON public.dish_tries FROM anon;

-- Public aggregate: how many people tried each dish (no user_id exposed)
CREATE OR REPLACE FUNCTION public.get_dish_tried_counts(_dish_ids uuid[])
RETURNS TABLE(dish_id uuid, tries_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dish_id, count(*)::bigint
  FROM public.dish_tries
  WHERE dish_id = ANY(_dish_ids)
  GROUP BY dish_id;
$$;

REVOKE ALL ON FUNCTION public.get_dish_tried_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dish_tried_counts(uuid[]) TO anon, authenticated;