CREATE TABLE public.dish_subtypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name_en text NOT NULL,
  name_th text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE INDEX dish_subtypes_category_active_idx
  ON public.dish_subtypes (category_id, is_active, display_order, name_en);

GRANT SELECT ON public.dish_subtypes TO anon, authenticated;
GRANT ALL ON public.dish_subtypes TO service_role;
ALTER TABLE public.dish_subtypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dish_subtypes public read active" ON public.dish_subtypes
  FOR SELECT USING (is_active = true);
CREATE POLICY "dish_subtypes admin read" ON public.dish_subtypes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dish_subtypes admin write" ON public.dish_subtypes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER dish_subtypes_updated_at BEFORE UPDATE ON public.dish_subtypes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.dishes
  ADD COLUMN subtype_id uuid REFERENCES public.dish_subtypes(id) ON DELETE RESTRICT;

CREATE INDEX dishes_subtype_id_idx ON public.dishes (subtype_id);

CREATE OR REPLACE FUNCTION public.category_has_active_subtypes(_category_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dish_subtypes
    WHERE category_id = _category_id AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.dish_ranking_key(_dish_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  d record;
BEGIN
  SELECT d.category_id, d.subtype_id, ds.is_active AS subtype_active
  INTO d
  FROM public.dishes d
  LEFT JOIN public.dish_subtypes ds ON ds.id = d.subtype_id
  WHERE d.id = _dish_id;

  IF d.category_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF d.subtype_id IS NOT NULL THEN
    IF d.subtype_active THEN
      RETURN 'subtype:' || d.subtype_id::text;
    END IF;
    RETURN NULL;
  END IF;

  IF public.category_has_active_subtypes(d.category_id) THEN
    RETURN NULL;
  END IF;

  RETURN 'category:' || d.category_id::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_dish_subtype_requirement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  has_active_subtypes boolean;
  subtype_category uuid;
  subtype_active boolean;
  has_comparisons boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.category_id IS DISTINCT FROM NEW.category_id OR OLD.subtype_id IS DISTINCT FROM NEW.subtype_id) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.comparisons
      WHERE dish_lo_id = OLD.id OR dish_hi_id = OLD.id
    ) INTO has_comparisons;
    IF has_comparisons THEN
      RAISE EXCEPTION 'Cannot change category or dish type after comparisons exist';
    END IF;
  END IF;

  has_active_subtypes := public.category_has_active_subtypes(NEW.category_id);

  IF has_active_subtypes AND NEW.subtype_id IS NULL THEN
    RAISE EXCEPTION 'Dish type is required for this category';
  END IF;

  IF NOT has_active_subtypes AND NEW.subtype_id IS NOT NULL THEN
    RAISE EXCEPTION 'Dish type is only allowed for categories with active dish types';
  END IF;

  IF NEW.subtype_id IS NOT NULL THEN
    SELECT category_id, is_active INTO subtype_category, subtype_active
    FROM public.dish_subtypes
    WHERE id = NEW.subtype_id;

    IF subtype_category IS NULL THEN
      RAISE EXCEPTION 'Dish type does not exist';
    END IF;

    IF subtype_category <> NEW.category_id THEN
      RAISE EXCEPTION 'Dish type must belong to the selected category';
    END IF;

    IF NOT subtype_active THEN
      RAISE EXCEPTION 'Dish type is inactive';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER dishes_subtype_requirement
  BEFORE INSERT OR UPDATE OF category_id, subtype_id
  ON public.dishes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dish_subtype_requirement();

CREATE OR REPLACE FUNCTION public.enforce_comparison_ranking_key()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  lo_dish record;
  hi_dish record;
  lo_key text;
  hi_key text;
BEGIN
  SELECT id, category_id, subtype_id, status INTO lo_dish
  FROM public.dishes WHERE id = NEW.dish_lo_id;
  SELECT id, category_id, subtype_id, status INTO hi_dish
  FROM public.dishes WHERE id = NEW.dish_hi_id;

  IF lo_dish.id IS NULL OR hi_dish.id IS NULL THEN
    RAISE EXCEPTION 'Dishes not found';
  END IF;

  IF NEW.winner_id <> NEW.dish_lo_id AND NEW.winner_id <> NEW.dish_hi_id THEN
    RAISE EXCEPTION 'Winner must be one of the two dishes';
  END IF;

  IF lo_dish.status <> 'approved' OR hi_dish.status <> 'approved' THEN
    RAISE EXCEPTION 'Dish not available for comparison';
  END IF;

  lo_key := public.dish_ranking_key(NEW.dish_lo_id);
  hi_key := public.dish_ranking_key(NEW.dish_hi_id);

  IF lo_key IS NULL OR hi_key IS NULL OR lo_key <> hi_key THEN
    RAISE EXCEPTION 'Dishes must share the same ranking key';
  END IF;

  IF lo_dish.category_id <> hi_dish.category_id THEN
    RAISE EXCEPTION 'Dishes must be in the same category';
  END IF;

  NEW.category_id := lo_dish.category_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER comparisons_ranking_key_guard
  BEFORE INSERT OR UPDATE OF category_id, dish_lo_id, dish_hi_id, winner_id
  ON public.comparisons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comparison_ranking_key();
