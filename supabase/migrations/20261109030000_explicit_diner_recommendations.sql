-- Explicit diner recommendations. This is intentionally separate from
-- dish_tries and immutable pairwise comparison / Elo history.
-- A person saying they tried something is not an endorsement.
BEGIN;

CREATE TABLE public.dish_recommendations (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 180),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dish_id),
  -- This also retracts a recommendation automatically when "tried" is removed.
  CONSTRAINT recommended_dish_was_tried
    FOREIGN KEY (user_id, dish_id)
    REFERENCES public.dish_tries(user_id, dish_id) ON DELETE CASCADE
);

CREATE INDEX dish_recommendations_recent_idx
  ON public.dish_recommendations (created_at DESC);
CREATE INDEX dish_recommendations_dish_idx
  ON public.dish_recommendations (dish_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_dish_recommendation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.dishes
    WHERE id = NEW.dish_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Only approved dishes can be recommended publicly';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.user_id AND username IS NOT NULL AND btrim(username) <> ''
  ) THEN
    RAISE EXCEPTION 'Claim a public username before recommending a dish';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER dish_recommendations_validate
BEFORE INSERT OR UPDATE ON public.dish_recommendations
FOR EACH ROW EXECUTE FUNCTION public.validate_dish_recommendation();

ALTER TABLE public.dish_recommendations ENABLE ROW LEVEL SECURITY;

-- Personal recommendations are public by explicit action only. An unclaimed
-- profile or unapproved dish never reveals a recommendation.
CREATE POLICY "public recommendations from claimed profiles"
ON public.dish_recommendations FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_id AND p.username IS NOT NULL AND btrim(p.username) <> ''
  )
  AND EXISTS (
    SELECT 1 FROM public.dishes d
    WHERE d.id = dish_id AND d.status = 'approved'
  )
);

CREATE POLICY "owner can see own recommendations"
ON public.dish_recommendations FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "owner can recommend"
ON public.dish_recommendations FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "owner can edit recommendation note"
ON public.dish_recommendations FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "owner can withdraw recommendation"
ON public.dish_recommendations FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON public.dish_recommendations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dish_recommendations TO authenticated;
GRANT ALL ON public.dish_recommendations TO service_role;

-- Authenticated users may not change a recommendation into a ranking vote:
-- this table has no triggers, RPCs, or grants touching Elo.
COMMIT;
