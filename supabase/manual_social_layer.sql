-- Manual migration: social layer for JaanNee
-- Run this in the Supabase SQL editor. Migrations are not auto-applied to live DB.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS tried_public boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL AND username <> '';

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS public.dish_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS dish_comments_dish_created_idx
  ON public.dish_comments (dish_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS follows_following_idx
  ON public.follows (following_id, created_at DESC);

GRANT SELECT ON public.follows TO anon, authenticated;
GRANT INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

GRANT SELECT ON public.dish_comments TO anon, authenticated;
GRANT INSERT, UPDATE ON public.dish_comments TO authenticated;
GRANT ALL ON public.dish_comments TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows public read"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "follows owner insert"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows owner delete"
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

CREATE POLICY "comments public read active"
  ON public.dish_comments FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "comments owner insert"
  ON public.dish_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments owner soft delete"
  ON public.dish_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
