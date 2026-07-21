CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS places_name_trgm_idx
  ON public.places USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_places_by_similarity(_term text)
RETURNS TABLE (
  id uuid,
  name text,
  area_id uuid,
  address text,
  similarity_score real
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.id, p.name, p.area_id, p.address, similarity(p.name, _term) AS similarity_score
  FROM public.places p
  WHERE p.status = 'approved'
    AND (p.name % _term OR p.name ILIKE '%' || _term || '%')
  ORDER BY similarity_score DESC, p.name
  LIMIT 8
$$;
