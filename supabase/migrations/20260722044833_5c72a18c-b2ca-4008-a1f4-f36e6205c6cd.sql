DROP POLICY IF EXISTS "places public read" ON public.places;
DROP POLICY IF EXISTS "follows public read" ON public.follows;
CREATE POLICY "follows authenticated read" ON public.follows FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.follows FROM anon;