-- JaanNee — manual migration
-- Adds a decorative header image to categories.
-- Presentation only: never used as, or mistakable for, a ranked dish photo.
-- Safe to re-run (idempotent).

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.categories.image_url IS
  'Optional decorative category banner image (storage path or absolute URL). Never a ranked dish photo.';

COMMIT;

-- Verification (read-only):
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'image_url';