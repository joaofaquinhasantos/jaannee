-- JaanNee: atomic, immutable comparisons
-- EXISTING LIVE DATABASE ONLY
-- MANUAL EXECUTION REQUIRED. This file is intentionally never auto-applied.
--
-- Run the whole file once in the Supabase SQL Editor. It is idempotent: it
-- replaces the comparison policies/functions/triggers with the intended final
-- state without rewriting existing comparison history or recalculating Elo.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Canonical pair integrity and one immutable vote per diner/pair
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.comparisons
    GROUP BY user_id, dish_lo_id, dish_hi_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enable immutable comparisons: duplicate diner/pair rows already exist. Resolve them before rerunning.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.comparisons'::regclass
      AND conname = 'comparisons_ordered_pair_check'
  ) THEN
    ALTER TABLE public.comparisons
      ADD CONSTRAINT comparisons_ordered_pair_check
      CHECK (dish_lo_id < dish_hi_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.comparisons'::regclass
      AND conname = 'comparisons_winner_in_pair_check'
  ) THEN
    ALTER TABLE public.comparisons
      ADD CONSTRAINT comparisons_winner_in_pair_check
      CHECK (winner_id = dish_lo_id OR winner_id = dish_hi_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.comparisons'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND regexp_replace(pg_get_indexdef(i.indexrelid), '\s+', ' ', 'g')
          ILIKE '%(user_id, dish_lo_id, dish_hi_id)%'
  ) THEN
    CREATE UNIQUE INDEX comparisons_user_pair_unique
      ON public.comparisons (user_id, dish_lo_id, dish_hi_id);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Reset comparison access: diners may read only their own history; all
--    writes go through the service-role-only atomic RPC.
-- ---------------------------------------------------------------------------
ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comparisons'
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.comparisons',
      policy_row.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY "comparisons owner select"
  ON public.comparisons
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.comparisons FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.comparisons FROM authenticated;
GRANT SELECT ON TABLE public.comparisons TO authenticated;
GRANT ALL ON TABLE public.comparisons TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Comparison rows cannot be changed or removed after insertion.
-- ---------------------------------------------------------------------------
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
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_comparison_immutable();

REVOKE ALL ON FUNCTION public.guard_comparison_immutable()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Elo and both comparison counters update from the inserted row in the
--    same database transaction. Dish rows are locked in canonical order.
-- ---------------------------------------------------------------------------
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
  SELECT COALESCE(elo, 1000)::numeric
    INTO STRICT lo_rating
  FROM public.dishes
  WHERE id = NEW.dish_lo_id
  FOR UPDATE;

  SELECT COALESCE(elo, 1000)::numeric
    INTO STRICT hi_rating
  FROM public.dishes
  WHERE id = NEW.dish_hi_id
  FOR UPDATE;

  expected_lo := 1 / (1 + power(10, (hi_rating - lo_rating) / 400));
  expected_hi := 1 / (1 + power(10, (lo_rating - hi_rating) / 400));
  score_lo := CASE WHEN NEW.winner_id = NEW.dish_lo_id THEN 1 ELSE 0 END;
  score_hi := 1 - score_lo;

  UPDATE public.dishes
  SET elo = lo_rating + k * (score_lo - expected_lo),
      comparisons_count = COALESCE(comparisons_count, 0) + 1
  WHERE id = NEW.dish_lo_id;

  UPDATE public.dishes
  SET elo = hi_rating + k * (score_hi - expected_hi),
      comparisons_count = COALESCE(comparisons_count, 0) + 1
  WHERE id = NEW.dish_hi_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comparisons_apply_elo ON public.comparisons;
CREATE TRIGGER trg_comparisons_apply_elo
  AFTER INSERT ON public.comparisons
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_comparison_elo_on_insert();

REVOKE ALL ON FUNCTION public.apply_comparison_elo_on_insert()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Single controlled write path. The app calls this through the server-side
--    service-role client after authenticating the diner. The function repeats
--    every load-bearing validation inside the atomic transaction.
-- ---------------------------------------------------------------------------
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

  IF _dish_a_id IS NULL
     OR _dish_b_id IS NULL
     OR _dish_a_id = _dish_b_id THEN
    RAISE EXCEPTION 'Choose two different dishes' USING ERRCODE = '22023';
  END IF;

  lo_id := LEAST(_dish_a_id, _dish_b_id);
  hi_id := GREATEST(_dish_a_id, _dish_b_id);

  IF _winner_id IS DISTINCT FROM lo_id
     AND _winner_id IS DISTINCT FROM hi_id THEN
    RAISE EXCEPTION 'Winner must be one of the two dishes'
      USING ERRCODE = '22023';
  END IF;

  -- Lock in the same lo/hi order used by the Elo trigger to avoid deadlocks.
  SELECT category_id, status
    INTO STRICT lo_category, lo_status
  FROM public.dishes
  WHERE id = lo_id
  FOR UPDATE;

  SELECT category_id, status
    INTO STRICT hi_category, hi_status
  FROM public.dishes
  WHERE id = hi_id
  FOR UPDATE;

  IF lo_status <> 'approved' OR hi_status <> 'approved' THEN
    RAISE EXCEPTION 'Dish not available for comparison'
      USING ERRCODE = '22023';
  END IF;

  IF lo_category IS NULL OR lo_category IS DISTINCT FROM hi_category THEN
    RAISE EXCEPTION 'Dishes must be in the same category'
      USING ERRCODE = '22023';
  END IF;

  lo_key := public.dish_ranking_key(lo_id);
  hi_key := public.dish_ranking_key(hi_id);

  IF lo_key IS NULL OR lo_key IS DISTINCT FROM hi_key THEN
    RAISE EXCEPTION 'Dishes must be in the same ranking pool'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dish_tries
    WHERE user_id = _user_id AND dish_id = lo_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.dish_tries
    WHERE user_id = _user_id AND dish_id = hi_id
  ) THEN
    RAISE EXCEPTION 'Mark both dishes as tried before comparing them'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.comparisons (
    user_id,
    category_id,
    dish_lo_id,
    dish_hi_id,
    winner_id
  ) VALUES (
    _user_id,
    lo_category,
    lo_id,
    hi_id,
    _winner_id
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

-- Elo must never be callable separately from inserting immutable history.
DROP FUNCTION IF EXISTS public.apply_elo(uuid, uuid, uuid, uuid, boolean);

COMMIT;
