ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS cuisine text;
