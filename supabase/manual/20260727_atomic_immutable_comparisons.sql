-- JaanNee: atomic, immutable comparisons
-- EXISTING LIVE DATABASE ONLY
-- MANUAL EXECUTION REQUIRED. This file has not been executed by Codex.

BEGIN;

DROP POLICY IF EXISTS "comparisons owner insert" ON public.comparisons;
DROP POLICY IF EXISTS "comparisons owner update" ON public.comparisons;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.comparisons FROM authenticated;
REVOKE ALL ON TABLE public.comparisons FROM anon;
GRANT SELECT ON TABLE public.comparisons TO authenticated;
GRANT ALL ON TABLE public.comparisons TO service_role;

CREATE OR REPLACE FUNCTION public.guard_comparison_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Comparison history is immutable' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_comparisons_immutable ON public.comparisons;
CREATE TRIGGER trg_comparisons_immutable
  BEFORE UPDATE OR DELETE ON public.comparisons
  FOR EACH ROW EXECUTE FUNCTION public.guard_comparison_immutable();

-- This trigger makes the row insert, both Elo changes, and both count changes
-- one transaction. Dish rows are locked in stable lo/hi order.
CREATE OR REPLACE FUNCTION public.apply_comparison_elo_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  k constant numeric := 32;
  lo_rating numeric;
  hi_rating numeric;
  expected_lo numeric;
  expected_hi numeric;
  score_lo numeric;
  score_hi numeric;
BEGIN
  SELECT elo INTO STRICT lo_rating
  FROM public.dishes WHERE id = NEW.dish_lo_id FOR UPDATE;

  SELECT elo INTO STRICT hi_rating
  FROM public.dishes WHERE id = NEW.dish_hi_id FOR UPDATE;

  expected_lo := 1 / (1 + power(10, (hi_rating - lo_rating) / 400));
  expected_hi := 1 / (1 + power(10, (lo_rating - hi_rating) / 400));
  score_lo := CASE WHEN NEW.winner_id = NEW.dish_lo_id THEN 1 ELSE 0 END;
  score_hi := 1 - score_lo;

  UPDATE public.dishes
  SET elo = lo_rating + k * (score_lo - expected_lo),
      comparisons_count = comparisons_count + 1
  WHERE id = NEW.dish_lo_id;

  UPDATE public.dishes
  SET elo = hi_rating + k * (score_hi - expected_hi),
      comparisons_count = comparisons_count + 1
  WHERE id = NEW.dish_hi_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comparisons_apply_elo ON public.comparisons;
CREATE TRIGGER trg_comparisons_apply_elo
  AFTER INSERT ON public.comparisons
  FOR EACH ROW EXECUTE FUNCTION public.apply_comparison_elo_on_insert();

CREATE OR REPLACE FUNCTION public.submit_comparison_atomic(
  _user_id uuid,
  _dish_a_id uuid,
  _dish_b_id uuid,
  _winner_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  lo_id uuid;
  hi_id uuid;
  lo_category uuid;
  hi_category uuid;
  lo_status public.dish_status;
  hi_status public.dish_status;
  lo_key text;
  hi_key text;
  comparison_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF _dish_a_id IS NULL OR _dish_b_id IS NULL OR _dish_a_id = _dish_b_id THEN
    RAISE EXCEPTION 'Choose two different dishes' USING ERRCODE = '22023';
  END IF;

  lo_id := LEAST(_dish_a_id, _dish_b_id);
  hi_id := GREATEST(_dish_a_id, _dish_b_id);
  IF _winner_id IS DISTINCT FROM lo_id AND _winner_id IS DISTINCT FROM hi_id THEN
    RAISE EXCEPTION 'Winner must be one of the two dishes' USING ERRCODE = '22023';
  END IF;

  SELECT category_id, status INTO STRICT lo_category, lo_status
  FROM public.dishes WHERE id = lo_id FOR UPDATE;
  SELECT category_id, status INTO STRICT hi_category, hi_status
  FROM public.dishes WHERE id = hi_id FOR UPDATE;

  IF lo_status <> 'approved' OR hi_status <> 'approved' THEN
    RAISE EXCEPTION 'Dish not available for comparison' USING ERRCODE = '22023';
  END IF;
  IF lo_category IS NULL OR lo_category IS DISTINCT FROM hi_category THEN
    RAISE EXCEPTION 'Dishes must be in the same category' USING ERRCODE = '22023';
  END IF;

  lo_key := public.dish_ranking_key(lo_id);
  hi_key := public.dish_ranking_key(hi_id);
  IF lo_key IS NULL OR lo_key IS DISTINCT FROM hi_key THEN
    RAISE EXCEPTION 'Dishes must be in the same ranking pool' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dish_tries WHERE user_id = _user_id AND dish_id = lo_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.dish_tries WHERE user_id = _user_id AND dish_id = hi_id
  ) THEN
    RAISE EXCEPTION 'Mark both dishes as tried before comparing them'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.comparisons
    WHERE user_id = _user_id AND dish_lo_id = lo_id AND dish_hi_id = hi_id
  ) THEN
    RAISE EXCEPTION 'You have already compared these two dishes'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.comparisons (
    user_id, category_id, dish_lo_id, dish_hi_id, winner_id
  ) VALUES (
    _user_id, lo_category, lo_id, hi_id, _winner_id
  )
  RETURNING id INTO comparison_id;

  RETURN comparison_id;
EXCEPTION
  WHEN no_data_found THEN
    RAISE EXCEPTION 'Dishes not found' USING ERRCODE = 'P0002';
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You have already compared these two dishes'
      USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.submit_comparison_atomic(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_comparison_atomic(uuid, uuid, uuid, uuid)
  TO service_role;

-- Elo must no longer be callable independently of inserting a comparison.
DROP FUNCTION IF EXISTS public.apply_elo(uuid, uuid, uuid, uuid, boolean);

COMMIT;
