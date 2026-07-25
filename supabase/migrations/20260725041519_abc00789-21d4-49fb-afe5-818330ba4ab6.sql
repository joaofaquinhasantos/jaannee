CREATE OR REPLACE FUNCTION public.normalize_dish_name(_s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(coalesce(_s,''), '\s+', ' ', 'g'));
$$;