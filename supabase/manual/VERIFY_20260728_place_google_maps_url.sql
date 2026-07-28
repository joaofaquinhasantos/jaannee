-- Read-only verification.

SELECT
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'places'
  AND column_name = 'google_maps_url';

SELECT
  count(*) FILTER (WHERE google_maps_url IS NOT NULL) AS places_with_maps_link,
  count(*) FILTER (
    WHERE google_maps_url IS NOT NULL
      AND google_maps_url !~ '^https://'
  ) AS non_https_links
FROM public.places;
