-- JaanNee post-moderation visibility
-- Run manually in the Supabase SQL editor.
-- Pending diner submissions become publicly viewable immediately, but all
-- discovery, tried, comparison, and ranking queries continue to require
-- status = 'approved'. Rejecting a dish or place removes public visibility.

BEGIN;

DROP POLICY IF EXISTS "dishes public read approved" ON public.dishes;
DROP POLICY IF EXISTS "dishes public read published" ON public.dishes;

CREATE POLICY "dishes public read published"
ON public.dishes
FOR SELECT
TO anon, authenticated
USING (status IN ('pending', 'approved'));

DROP POLICY IF EXISTS "places_select_approved" ON public.places;
DROP POLICY IF EXISTS "places_select_published" ON public.places;

CREATE POLICY "places_select_published"
ON public.places
FOR SELECT
TO anon, authenticated
USING (status IN ('pending', 'approved'));

COMMIT;

