
-- 1. Revoke apply_elo from authenticated
REVOKE EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) TO service_role;

-- 2. Places moderation
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop existing SELECT policies on places and recreate
DROP POLICY IF EXISTS "Places are viewable by everyone" ON public.places;
DROP POLICY IF EXISTS "Public can view places" ON public.places;
DROP POLICY IF EXISTS "Anyone can view places" ON public.places;
DROP POLICY IF EXISTS "places_select_public" ON public.places;
DROP POLICY IF EXISTS "places_select_approved" ON public.places;
DROP POLICY IF EXISTS "places_select_owner" ON public.places;
DROP POLICY IF EXISTS "places_select_admin" ON public.places;
DROP POLICY IF EXISTS "places_update_admin" ON public.places;

CREATE POLICY "places_select_approved" ON public.places
  FOR SELECT USING (status = 'approved');

CREATE POLICY "places_select_owner" ON public.places
  FOR SELECT TO authenticated USING (created_by = auth.uid());

CREATE POLICY "places_select_admin" ON public.places
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "places_update_admin" ON public.places
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
