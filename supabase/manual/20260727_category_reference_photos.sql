-- JaanNee: admin-managed category reference photos.
-- EXISTING LIVE DATABASE ONLY.
-- MANUAL EXECUTION REQUIRED. This file has not been executed by Codex.

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS reference_photo_url text;

COMMENT ON COLUMN public.categories.reference_photo_url IS
  'Admin-managed visual reference for category navigation; never a ranked dish.';

COMMIT;
