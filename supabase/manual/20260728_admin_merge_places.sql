-- JaanNee: safely merge duplicate places.
-- Run manually in the Supabase SQL editor before using the Admin merge-place action.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_merge_places(
  _keep_id uuid,
  _remove_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  keep_place public.places%ROWTYPE;
  remove_place public.places%ROWTYPE;
  moved_count integer;
  conflict_names text;
BEGIN
  IF _keep_id = _remove_id THEN
    RAISE EXCEPTION 'Choose two different places.';
  END IF;

  SELECT * INTO keep_place
  FROM public.places
  WHERE id = _keep_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Place to keep was not found.';
  END IF;

  SELECT * INTO remove_place
  FROM public.places
  WHERE id = _remove_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Place to remove was not found.';
  END IF;

  SELECT string_agg(DISTINCT removed.name_en, ', ' ORDER BY removed.name_en)
  INTO conflict_names
  FROM public.dishes AS removed
  JOIN public.dishes AS kept
    ON kept.place_id = _keep_id
   AND kept.status <> 'rejected'
   AND public.normalize_dish_name(kept.name_en)
       = public.normalize_dish_name(removed.name_en)
  WHERE removed.place_id = _remove_id
    AND removed.status <> 'rejected';

  IF conflict_names IS NOT NULL THEN
    RAISE EXCEPTION
      'Merge blocked: duplicate dish names would be created at the kept place: %',
      conflict_names;
  END IF;

  UPDATE public.places
  SET
    address = COALESCE(keep_place.address, remove_place.address),
    lat = COALESCE(keep_place.lat, remove_place.lat),
    lng = COALESCE(keep_place.lng, remove_place.lng)
  WHERE id = _keep_id;

  UPDATE public.dishes
  SET place_id = _keep_id
  WHERE place_id = _remove_id;

  GET DIAGNOSTICS moved_count = ROW_COUNT;

  DELETE FROM public.places
  WHERE id = _remove_id;

  RETURN jsonb_build_object(
    'kept_place_id', _keep_id,
    'removed_place_id', _remove_id,
    'dishes_moved', moved_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_merge_places(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merge_places(uuid, uuid)
  TO service_role;

COMMIT;
