-- Tighten two inherited discovery policies: unreviewed submissions must
-- never be publicly enumerable or publishable by the submitter.
-- Owners and administrators retain their separate read policies.
BEGIN;
ALTER POLICY "places_select_published" ON public.places
  USING (status = 'approved');
ALTER POLICY "places auth insert" ON public.places
  WITH CHECK ((select auth.uid()) = created_by AND status = 'pending');
ALTER POLICY "dishes public read published" ON public.dishes
  USING (status = 'approved'::public.dish_status);
COMMIT;
