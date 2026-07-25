
-- ============================================================================
-- JaanNee integrity hardening (2026-07-25)
-- Rank the dish, not the restaurant. Rank the specific variant, not a bucket.
-- ============================================================================

-- 1. Categories: requires_subtype flag ---------------------------------------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS requires_subtype boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.categories.requires_subtype IS
  'When true, dishes in this category must be assigned a sub-type before approval and appear in leaderboards only under that sub-type.';

-- 2. Approval-time sub-type enforcement --------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_dish_approval_subtype()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cat_requires boolean;
  has_active_subtypes boolean;
  st_active boolean;
  st_category uuid;
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  IF NEW.category_id IS NULL THEN
    RAISE EXCEPTION 'Cannot approve a dish without a category';
  END IF;

  SELECT requires_subtype INTO cat_requires
  FROM public.categories WHERE id = NEW.category_id;

  has_active_subtypes := public.category_has_active_subtypes(NEW.category_id);

  IF (cat_requires OR has_active_subtypes) AND NEW.subtype_id IS NULL THEN
    RAISE EXCEPTION 'This category requires a dish type before approval';
  END IF;

  IF NEW.subtype_id IS NOT NULL THEN
    SELECT category_id, is_active INTO st_category, st_active
    FROM public.dish_subtypes WHERE id = NEW.subtype_id;
    IF st_category IS NULL OR st_category <> NEW.category_id THEN
      RAISE EXCEPTION 'Dish type must belong to the dish''s category';
    END IF;
    IF NOT st_active THEN
      RAISE EXCEPTION 'Dish type is inactive';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dishes_approval_subtype ON public.dishes;
CREATE TRIGGER trg_dishes_approval_subtype
  BEFORE INSERT OR UPDATE OF status, subtype_id, category_id ON public.dishes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dish_approval_subtype();

-- 3. Tried-before-voting enforcement -----------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_comparison_tried()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tried_count int;
BEGIN
  SELECT count(*) INTO tried_count
  FROM public.dish_tries
  WHERE user_id = NEW.user_id
    AND dish_id IN (NEW.dish_lo_id, NEW.dish_hi_id);
  IF tried_count < 2 THEN
    RAISE EXCEPTION 'You must mark both dishes as tried before comparing them';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comparisons_tried ON public.comparisons;
CREATE TRIGGER trg_comparisons_tried
  BEFORE INSERT OR UPDATE OF user_id, dish_lo_id, dish_hi_id ON public.comparisons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comparison_tried();

-- 4. Delete guard: no delete if comparisons exist ----------------------------
CREATE OR REPLACE FUNCTION public.guard_dish_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.comparisons
    WHERE dish_lo_id = OLD.id OR dish_hi_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete dish % — it has pairwise comparisons. Merge into another dish instead.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_dishes_delete_guard ON public.dishes;
CREATE TRIGGER trg_dishes_delete_guard
  BEFORE DELETE ON public.dishes
  FOR EACH ROW EXECUTE FUNCTION public.guard_dish_delete();

-- 5. Admin-safe merge function -----------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_merge_dishes(_keep_id uuid, _remove_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keep_cat uuid;
  remove_cat uuid;
  keep_sub uuid;
  remove_sub uuid;
BEGIN
  IF _keep_id = _remove_id THEN
    RAISE EXCEPTION 'Choose two different dishes';
  END IF;

  SELECT category_id, subtype_id INTO keep_cat, keep_sub FROM public.dishes WHERE id = _keep_id FOR UPDATE;
  SELECT category_id, subtype_id INTO remove_cat, remove_sub FROM public.dishes WHERE id = _remove_id FOR UPDATE;

  IF keep_cat IS NULL OR remove_cat IS NULL THEN
    RAISE EXCEPTION 'Both dishes must exist';
  END IF;
  IF keep_cat <> remove_cat OR COALESCE(keep_sub::text,'') <> COALESCE(remove_sub::text,'') THEN
    RAISE EXCEPTION 'Dishes must share the same category and dish type to merge';
  END IF;

  -- Move tried-marks (dedupe on unique (user_id, dish_id))
  INSERT INTO public.dish_tries (user_id, dish_id, created_at)
  SELECT dt.user_id, _keep_id, dt.created_at
  FROM public.dish_tries dt
  WHERE dt.dish_id = _remove_id
  ON CONFLICT (user_id, dish_id) DO NOTHING;
  DELETE FROM public.dish_tries WHERE dish_id = _remove_id;

  -- Move reports
  UPDATE public.reports SET dish_id = _keep_id WHERE dish_id = _remove_id;

  -- Rewrite comparisons that reference remove_id to point at keep_id, honoring lo/hi ordering.
  -- Delete self-referencing rows first (e.g. keep vs remove — now becomes keep vs keep).
  DELETE FROM public.comparisons
   WHERE (dish_lo_id = _remove_id AND dish_hi_id = _keep_id)
      OR (dish_hi_id = _remove_id AND dish_lo_id = _keep_id);

  UPDATE public.comparisons
     SET dish_lo_id = LEAST(_keep_id, CASE WHEN dish_hi_id = _remove_id THEN dish_lo_id ELSE dish_hi_id END),
         dish_hi_id = GREATEST(_keep_id, CASE WHEN dish_hi_id = _remove_id THEN dish_lo_id ELSE dish_hi_id END),
         winner_id  = CASE WHEN winner_id = _remove_id THEN _keep_id ELSE winner_id END
   WHERE dish_lo_id = _remove_id OR dish_hi_id = _remove_id;

  -- Now safe to delete (guard passes because no comparison references remove_id anymore)
  DELETE FROM public.dishes WHERE id = _remove_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_merge_dishes(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merge_dishes(uuid, uuid) TO service_role;

-- 6. Duplicate-name guard at same restaurant ---------------------------------
CREATE OR REPLACE FUNCTION public.normalize_dish_name(_s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(coalesce(_s,''), '\s+', ' ', 'g'));
$$;

CREATE UNIQUE INDEX IF NOT EXISTS dishes_unique_name_per_place
  ON public.dishes (place_id, public.normalize_dish_name(name_en))
  WHERE status <> 'rejected';

-- 7. nearby_places haversine RPC ---------------------------------------------
CREATE OR REPLACE FUNCTION public.nearby_places(_lat double precision, _lng double precision, _radius_km double precision DEFAULT 5)
RETURNS TABLE(id uuid, name text, address text, area_id uuid, lat double precision, lng double precision, distance_km double precision)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.name, p.address, p.area_id, p.lat, p.lng,
    (6371.0 * acos(
      cos(radians(_lat)) * cos(radians(p.lat)) *
      cos(radians(p.lng) - radians(_lng)) +
      sin(radians(_lat)) * sin(radians(p.lat))
    )) AS distance_km
  FROM public.places p
  WHERE p.status = 'approved'
    AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    AND (6371.0 * acos(
      cos(radians(_lat)) * cos(radians(p.lat)) *
      cos(radians(p.lng) - radians(_lng)) +
      sin(radians(_lat)) * sin(radians(p.lat))
    )) <= _radius_km
  ORDER BY distance_km ASC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.nearby_places(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nearby_places(double precision, double precision, double precision) TO anon, authenticated, service_role;

-- Storage MIME/size limits are applied via supabase--storage_update_bucket (see manual/README).
