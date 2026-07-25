-- JaanNee integrity hardening — MANUAL SQL (2026-07-25, corrected).
--
-- Depends on the existing JaanNee schema (see supabase/migrations/*). This
-- file is NOT a fresh-environment snapshot. It brings a live JaanNee
-- database to the intended final integrity state described in
-- JAANNEE_PRODUCT_RULES.md.
--
-- Execution rules (see supabase/manual/README.md):
--   * Manual only. Do NOT auto-apply through the Lovable migration tool.
--   * Run once via the Supabase SQL editor by a human operator.
--   * Verify with supabase/manual/VERIFY_20260725_integrity_hardening.sql.
--
-- Sections:
--   1. categories.requires_subtype flag + admin-approved seeds
--   2. dish_ranking_key (uses requires_subtype OR active sub-types)
--   3. tried-before-voting trigger (fires on ALL updates, including winner)
--   4. delete guard
--   5. SAFE admin_merge_dishes (no comparison writes; blocks when history exists)
--   6. normalize_dish_name (trim + collapse whitespace) with unique-index rebuild
--   7. Approved sub-type reference data (idempotent, conflict-safe)
--   8. nearby_places (bbox prefilter, radius/max_results caps, service-role only)
--   9. Sensitive-function grants (service_role only)
--  10. Storage bucket restrictions (dish-photos: 8MB, JPEG/PNG/WebP)

BEGIN;

-- ---------------------------------------------------------------------
-- 1. categories.requires_subtype flag
-- ---------------------------------------------------------------------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS requires_subtype boolean NOT NULL DEFAULT false;

-- Mark the seven approved subtype-scoped categories. If a slug is missing
-- we RAISE NOTICE and continue — never fabricate a category.
DO $$
DECLARE
  slugs text[] := ARRAY[
    'sushi','dim-sum','tapas','korean-bbq','steak','specialty-coffee','matcha'
  ];
  s text;
  found int;
BEGIN
  FOREACH s IN ARRAY slugs LOOP
    UPDATE public.categories SET requires_subtype = true WHERE slug = s;
    GET DIAGNOSTICS found = ROW_COUNT;
    IF found = 0 THEN
      RAISE NOTICE 'category slug % is missing — not creating a replacement', s;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. dish_ranking_key: subtype-scoped when requires_subtype OR active subs
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.category_is_subtype_scoped(_category_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT requires_subtype FROM public.categories WHERE id = _category_id),
    false
  ) OR EXISTS (
    SELECT 1 FROM public.dish_subtypes
    WHERE category_id = _category_id AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.dish_ranking_key(_dish_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
  d record;
  scoped boolean;
BEGIN
  SELECT d.category_id, d.subtype_id, ds.is_active AS subtype_active, ds.category_id AS subtype_category
  INTO d
  FROM public.dishes d
  LEFT JOIN public.dish_subtypes ds ON ds.id = d.subtype_id
  WHERE d.id = _dish_id;

  IF d.category_id IS NULL THEN
    RETURN NULL;
  END IF;

  scoped := public.category_is_subtype_scoped(d.category_id);

  IF scoped THEN
    IF d.subtype_id IS NULL THEN RETURN NULL; END IF;
    IF NOT COALESCE(d.subtype_active, false) THEN RETURN NULL; END IF;
    IF d.subtype_category IS DISTINCT FROM d.category_id THEN RETURN NULL; END IF;
    RETURN 'subtype:' || d.subtype_id::text;
  ELSE
    IF d.subtype_id IS NOT NULL THEN RETURN NULL; END IF;
    RETURN 'category:' || d.category_id::text;
  END IF;
END;
$$;

-- Approval-time enforcement uses the same "scoped" test.
CREATE OR REPLACE FUNCTION public.enforce_dish_approval_subtype()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  scoped boolean;
  st_active boolean;
  st_category uuid;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF NEW.category_id IS NULL THEN
    RAISE EXCEPTION 'Cannot approve a dish without a category';
  END IF;
  scoped := public.category_is_subtype_scoped(NEW.category_id);
  IF scoped AND NEW.subtype_id IS NULL THEN
    RAISE EXCEPTION 'This category requires a dish type before approval';
  END IF;
  IF NEW.subtype_id IS NOT NULL THEN
    SELECT category_id, is_active INTO st_category, st_active
      FROM public.dish_subtypes WHERE id = NEW.subtype_id;
    IF st_category IS NULL OR st_category <> NEW.category_id THEN
      RAISE EXCEPTION 'Dish type must belong to the dish''s category';
    END IF;
    IF NOT st_active THEN
      RAISE EXCEPTION 'Dish type is inactive';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_dishes_approval_subtype ON public.dishes;
CREATE TRIGGER trg_dishes_approval_subtype
  BEFORE INSERT OR UPDATE OF status, subtype_id, category_id ON public.dishes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dish_approval_subtype();

-- ---------------------------------------------------------------------
-- 3. Tried-before-voting trigger — fires on ALL updates so winner-only
--    edits are also validated.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_comparison_tried()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE tried_count int;
BEGIN
  SELECT count(*) INTO tried_count
  FROM public.dish_tries
  WHERE user_id = NEW.user_id
    AND dish_id IN (NEW.dish_lo_id, NEW.dish_hi_id);
  IF tried_count < 2 THEN
    RAISE EXCEPTION 'You must mark both dishes as tried before comparing them';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_comparisons_tried ON public.comparisons;
CREATE TRIGGER trg_comparisons_tried
  BEFORE INSERT OR UPDATE ON public.comparisons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comparison_tried();

-- ---------------------------------------------------------------------
-- 4. Delete guard: any comparison reference blocks deletion.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_dish_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.comparisons
    WHERE dish_lo_id = OLD.id OR dish_hi_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete dish % — it has ranking history and is protected.', OLD.id;
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_dishes_delete_guard ON public.dishes;
CREATE TRIGGER trg_dishes_delete_guard BEFORE DELETE ON public.dishes
  FOR EACH ROW EXECUTE FUNCTION public.guard_dish_delete();

-- ---------------------------------------------------------------------
-- 5. SAFE admin_merge_dishes
--
-- Merging is only allowed BEFORE either dish has any comparison history.
-- Comparisons, Elo, and comparisons_count are NEVER rewritten by merge.
-- Additional constraints: same place, same category, same subtype (null-safe).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_merge_dishes(_keep_id uuid, _remove_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  keep_row   public.dishes%ROWTYPE;
  remove_row public.dishes%ROWTYPE;
  moved_tries int := 0;
  moved_reports int := 0;
BEGIN
  IF _keep_id IS NULL OR _remove_id IS NULL THEN
    RAISE EXCEPTION 'Both dish ids are required';
  END IF;
  IF _keep_id = _remove_id THEN
    RAISE EXCEPTION 'Choose two different dishes';
  END IF;

  SELECT * INTO keep_row   FROM public.dishes WHERE id = _keep_id   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Keep dish does not exist'; END IF;
  SELECT * INTO remove_row FROM public.dishes WHERE id = _remove_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Remove dish does not exist'; END IF;

  IF keep_row.place_id IS NULL OR remove_row.place_id IS NULL
     OR keep_row.place_id <> remove_row.place_id THEN
    RAISE EXCEPTION 'Merge requires both dishes to belong to the same place';
  END IF;

  IF keep_row.category_id IS NULL OR remove_row.category_id IS NULL
     OR keep_row.category_id <> remove_row.category_id THEN
    RAISE EXCEPTION 'Merge requires both dishes to share the same category';
  END IF;

  IF keep_row.subtype_id IS DISTINCT FROM remove_row.subtype_id THEN
    RAISE EXCEPTION 'Merge requires both dishes to share the same dish type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.comparisons
     WHERE dish_lo_id IN (_keep_id, _remove_id)
        OR dish_hi_id IN (_keep_id, _remove_id)
  ) THEN
    RAISE EXCEPTION 'Cannot merge — one or both dishes already have ranking history. Ranking history is never rewritten.';
  END IF;

  -- Transfer tried marks (conflict-safe), then remove the duplicate's.
  WITH inserted AS (
    INSERT INTO public.dish_tries (user_id, dish_id, created_at)
    SELECT dt.user_id, _keep_id, dt.created_at
      FROM public.dish_tries dt
     WHERE dt.dish_id = _remove_id
    ON CONFLICT (user_id, dish_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO moved_tries FROM inserted;
  DELETE FROM public.dish_tries WHERE dish_id = _remove_id;

  -- Transfer reports.
  WITH upd AS (
    UPDATE public.reports SET dish_id = _keep_id
     WHERE dish_id = _remove_id
    RETURNING 1
  )
  SELECT count(*) INTO moved_reports FROM upd;

  -- Finally remove the duplicate. The delete guard is safe here because
  -- we already asserted no comparisons reference either dish.
  DELETE FROM public.dishes WHERE id = _remove_id;

  RETURN jsonb_build_object(
    'ok', true,
    'kept', _keep_id,
    'removed', _remove_id,
    'moved_tries', moved_tries,
    'moved_reports', moved_reports
  );
END; $$;

REVOKE ALL ON FUNCTION public.admin_merge_dishes(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merge_dishes(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 6. Corrected normalize_dish_name + index rebuild
-- ---------------------------------------------------------------------
-- The index predicate excludes rejected rows so a bad past submission
-- cannot permanently block a valid future one. This is intentional.
CREATE OR REPLACE FUNCTION public.normalize_dish_name(_s text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT lower(btrim(regexp_replace(coalesce(_s,''), '\s+', ' ', 'g')));
$$;

-- Pre-check: refuse to rebuild if the new normalisation would violate
-- uniqueness against existing rows.
DO $$
DECLARE conflict_count int;
BEGIN
  SELECT count(*) INTO conflict_count FROM (
    SELECT place_id, public.normalize_dish_name(name_en) AS n
      FROM public.dishes
     WHERE status <> 'rejected'
     GROUP BY 1,2 HAVING count(*) > 1
  ) x;
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Cannot rebuild unique index: % duplicate (place, normalized name) groups exist under the new normalisation. Resolve them before re-running.', conflict_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.dishes_unique_name_per_place;
CREATE UNIQUE INDEX dishes_unique_name_per_place
  ON public.dishes (place_id, public.normalize_dish_name(name_en))
  WHERE status <> 'rejected';

-- ---------------------------------------------------------------------
-- 7. Approved sub-type reference data (idempotent)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  seeds jsonb := $seeds$[
    {"cat":"sushi","subs":[
      {"slug":"nigiri","en":"Nigiri","th":"นิกิริ","o":10},
      {"slug":"maki-roll","en":"Maki Roll","th":"มากิโรล","o":20},
      {"slug":"temaki","en":"Temaki","th":"เทมากิ","o":30},
      {"slug":"chirashi","en":"Chirashi","th":"ชิราชิ","o":40}
    ]},
    {"cat":"dim-sum","subs":[
      {"slug":"har-gow","en":"Har Gow","th":"ฮะเก๋า","o":10},
      {"slug":"siu-mai","en":"Siu Mai","th":"ขนมจีบ","o":20},
      {"slug":"char-siu-bao","en":"Char Siu Bao","th":"ซาลาเปาหมูแดง","o":30},
      {"slug":"xiao-long-bao","en":"Xiao Long Bao","th":"เสี่ยวหลงเปา","o":40}
    ]},
    {"cat":"tapas","subs":[
      {"slug":"patatas-bravas","en":"Patatas Bravas","th":"ปาตาตัสบราวาส","o":10},
      {"slug":"croquetas","en":"Croquetas","th":"โครเกตัส","o":20},
      {"slug":"gambas-al-ajillo","en":"Gambas al Ajillo","th":"กุ้งกระเทียมสเปน","o":30},
      {"slug":"tortilla-espanola","en":"Tortilla Española","th":"ไข่เจียวสเปน","o":40}
    ]},
    {"cat":"korean-bbq","subs":[
      {"slug":"samgyeopsal","en":"Samgyeopsal","th":"ซัมกยอบซัล","o":10},
      {"slug":"galbi","en":"Galbi","th":"คัลบี","o":20},
      {"slug":"bulgogi","en":"Bulgogi","th":"บุลโกกิ","o":30}
    ]},
    {"cat":"steak","subs":[
      {"slug":"ribeye","en":"Ribeye","th":"ริบอาย","o":10},
      {"slug":"sirloin","en":"Sirloin","th":"เซอร์ลอยน์","o":20},
      {"slug":"tenderloin","en":"Tenderloin","th":"เทนเดอร์ลอยน์","o":30}
    ]},
    {"cat":"specialty-coffee","subs":[
      {"slug":"espresso","en":"Espresso","th":"เอสเปรสโซ","o":10},
      {"slug":"flat-white","en":"Flat White","th":"แฟลตไวท์","o":20},
      {"slug":"cappuccino","en":"Cappuccino","th":"คาปูชิโน","o":30},
      {"slug":"pour-over","en":"Pour Over","th":"กาแฟดริป","o":40},
      {"slug":"cold-brew","en":"Cold Brew","th":"โคลด์บรูว์","o":50}
    ]},
    {"cat":"matcha","subs":[
      {"slug":"usucha","en":"Usucha","th":"อุสุฉะ","o":10},
      {"slug":"matcha-latte","en":"Matcha Latte","th":"มัทฉะลาเต้","o":20},
      {"slug":"matcha-tonic","en":"Matcha Tonic","th":"มัทฉะโทนิก","o":30}
    ]}
  ]$seeds$;
  cat_row jsonb;
  sub_row jsonb;
  cat_id uuid;
BEGIN
  FOR cat_row IN SELECT * FROM jsonb_array_elements(seeds) LOOP
    SELECT id INTO cat_id FROM public.categories WHERE slug = cat_row->>'cat';
    IF cat_id IS NULL THEN
      RAISE NOTICE 'category slug % is missing — skipping sub-type seeds', cat_row->>'cat';
      CONTINUE;
    END IF;
    FOR sub_row IN SELECT * FROM jsonb_array_elements(cat_row->'subs') LOOP
      INSERT INTO public.dish_subtypes (category_id, slug, name_en, name_th, is_active, display_order)
      VALUES (cat_id, sub_row->>'slug', sub_row->>'en', sub_row->>'th', true,
              (sub_row->>'o')::int)
      ON CONFLICT (category_id, slug) DO UPDATE
        SET name_en = EXCLUDED.name_en,
            name_th = EXCLUDED.name_th,
            is_active = true,
            display_order = EXCLUDED.display_order;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 8. nearby_places — 4 args, bbox prefilter, safe caps, service-role only.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.nearby_places(double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.nearby_places(double precision, double precision, double precision, integer);

CREATE OR REPLACE FUNCTION public.nearby_places(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT 5,
  _max_results integer DEFAULT 20
)
RETURNS TABLE(id uuid, name text, address text, area_id uuid,
              lat double precision, lng double precision, distance_km double precision)
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
  MAX_RADIUS_KM constant double precision := 50;
  MAX_RESULTS   constant integer          := 50;
  radius_km double precision;
  max_rows  integer;
  lat_delta double precision;
  lng_delta double precision;
BEGIN
  IF _lat IS NULL OR _lng IS NULL THEN
    RAISE EXCEPTION 'Latitude and longitude are required';
  END IF;
  IF _lat < -90 OR _lat > 90 THEN
    RAISE EXCEPTION 'Latitude must be between -90 and 90';
  END IF;
  IF _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Longitude must be between -180 and 180';
  END IF;
  IF _radius_km IS NULL OR _radius_km <= 0 THEN
    RAISE EXCEPTION 'Radius must be positive';
  END IF;

  radius_km := least(_radius_km, MAX_RADIUS_KM);
  max_rows  := greatest(1, least(coalesce(_max_results, 20), MAX_RESULTS));

  lat_delta := radius_km / 111.0;
  lng_delta := radius_km / greatest(1e-6, 111.0 * cos(radians(_lat)));

  RETURN QUERY
  WITH bbox AS (
    SELECT p.id, p.name, p.address, p.area_id, p.lat, p.lng
      FROM public.places p
     WHERE p.status = 'approved'
       AND p.lat IS NOT NULL AND p.lng IS NOT NULL
       AND p.lat BETWEEN (_lat - lat_delta) AND (_lat + lat_delta)
       AND p.lng BETWEEN (_lng - lng_delta) AND (_lng + lng_delta)
  ),
  scored AS (
    SELECT b.*,
      (6371.0 * acos( greatest(-1.0, least(1.0,
          cos(radians(_lat)) * cos(radians(b.lat)) *
          cos(radians(b.lng) - radians(_lng)) +
          sin(radians(_lat)) * sin(radians(b.lat))
        ))
      )) AS d_km
      FROM bbox b
  )
  SELECT s.id, s.name, s.address, s.area_id, s.lat, s.lng, s.d_km
    FROM scored s
   WHERE s.d_km <= radius_km
   ORDER BY s.d_km ASC
   LIMIT max_rows;
END; $$;

REVOKE ALL ON FUNCTION public.nearby_places(double precision, double precision, double precision, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_places(double precision, double precision, double precision, integer)
  TO service_role;

-- ---------------------------------------------------------------------
-- 9. Sensitive-function grants (belt and suspenders).
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.get_dish_tried_counts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dish_tried_counts(uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.get_follow_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------
-- 10. Storage bucket restrictions (dish-photos)
--
-- Cannot be inside the transaction above because storage.buckets is not
-- always accessible via app roles. Run in the same manual session.
-- ---------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 8388608,
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[],
       public = false
 WHERE id = 'dish-photos';
