ALTER TABLE public.dishes
  ALTER COLUMN category_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS requested_category_en text,
  ADD COLUMN IF NOT EXISTS requested_category_th text;
