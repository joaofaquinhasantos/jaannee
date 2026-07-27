-- JaanNee pre-launch privacy and ranking-pool guards.
-- EXISTING LIVE DATABASE ONLY. Manual execution required.

BEGIN;

-- Only claimed profiles are public. Owners and admins retain access.
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
DROP POLICY IF EXISTS "profiles claimed public read" ON public.profiles;
DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
DROP POLICY IF EXISTS "profiles admin read" ON public.profiles;

CREATE POLICY "profiles claimed public read"
  ON public.profiles FOR SELECT
  USING (username IS NOT NULL AND btrim(username) <> '');

CREATE POLICY "profiles self read"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles admin read"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Tried marks may only reference approved dishes.
CREATE OR REPLACE FUNCTION public.enforce_tried_dish_approved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.dishes
    WHERE id = NEW.dish_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Only approved dishes can be marked as tried';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dish_tries_approved ON public.dish_tries;
CREATE TRIGGER trg_dish_tries_approved
  BEFORE INSERT OR UPDATE OF dish_id ON public.dish_tries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tried_dish_approved();

-- Prevent category pool-shape changes after ranking history exists.
CREATE OR REPLACE FUNCTION public.guard_category_pool_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.requires_subtype IS DISTINCT FROM OLD.requires_subtype
     AND EXISTS (
       SELECT 1
       FROM public.comparisons c
       WHERE c.category_id = OLD.id
     ) THEN
    RAISE EXCEPTION
      'Cannot change dish-type requirements after comparison history exists';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_pool_shape ON public.categories;
CREATE TRIGGER trg_categories_pool_shape
  BEFORE UPDATE OF requires_subtype ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.guard_category_pool_shape();

CREATE OR REPLACE FUNCTION public.guard_subtype_pool_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  affected_category uuid;
BEGIN
  affected_category := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.category_id
    ELSE NEW.category_id
  END;
  IF TG_OP = 'INSERT' AND NEW.is_active AND NOT EXISTS (
    SELECT 1 FROM public.dish_subtypes
    WHERE category_id = NEW.category_id AND is_active
  ) AND EXISTS (
    SELECT 1 FROM public.comparisons WHERE category_id = NEW.category_id
  ) THEN
    RAISE EXCEPTION
      'Cannot introduce the first dish type after comparison history exists';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
     )
     AND EXISTS (
       SELECT 1
       FROM public.comparisons c
       JOIN public.dishes d
         ON d.id IN (c.dish_lo_id, c.dish_hi_id)
       WHERE d.subtype_id = OLD.id OR c.category_id = affected_category
     ) THEN
    RAISE EXCEPTION
      'Cannot change a dish type after comparison history exists';
  END IF;

  IF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1
    FROM public.comparisons c
    JOIN public.dishes d ON d.id IN (c.dish_lo_id, c.dish_hi_id)
    WHERE d.subtype_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'Cannot delete a dish type after comparison history exists';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subtypes_pool_shape ON public.dish_subtypes;
CREATE TRIGGER trg_subtypes_pool_shape
  BEFORE INSERT OR UPDATE OF is_active, category_id OR DELETE
  ON public.dish_subtypes
  FOR EACH ROW EXECUTE FUNCTION public.guard_subtype_pool_shape();

COMMIT;
