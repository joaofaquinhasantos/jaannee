-- Manual migration: coordinates for nearby place picking.
-- Run this in the Supabase SQL editor. Migrations are not auto-applied to live DB.

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

CREATE INDEX IF NOT EXISTS places_lat_lng_status_idx
  ON public.places (status, lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
