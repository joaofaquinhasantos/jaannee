-- New self-service restaurant workflow. A business draft is NOT a JaanNee
-- public place and cannot acquire an existing place's identity without review.
-- This is separate from the live dish-ranking and restaurant-claims tables.
BEGIN;

CREATE TABLE public.restaurant_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) BETWEEN 6 AND 100),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 80),
  area_label text NOT NULL CHECK (length(btrim(area_label)) BETWEEN 2 AND 100),
  cuisine text NOT NULL CHECK (length(btrim(cuisine)) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  verification_note text NOT NULL DEFAULT '' CHECK (length(verification_note) <= 1000),
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft','submitted','rejected','verified')),
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  verified_place_id uuid UNIQUE REFERENCES public.places(id) ON DELETE SET NULL,
  published_at timestamptz,
  plan_tier text NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free','pro','growth')),
  billing_status text NOT NULL DEFAULT 'free'
    CHECK (billing_status IN ('free','trialing','active','past_due','canceled')),
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_publication_requires_verification
    CHECK (published_at IS NULL OR (review_status = 'verified' AND verified_place_id IS NOT NULL)),
  CONSTRAINT business_paid_tier_requires_billing
    CHECK (plan_tier = 'free' OR billing_status IN ('trialing','active','past_due','canceled'))
);
CREATE INDEX restaurant_businesses_owner_idx ON public.restaurant_businesses (owner_id, created_at DESC);
CREATE INDEX restaurant_businesses_review_idx ON public.restaurant_businesses (review_status, created_at DESC);
CREATE INDEX restaurant_businesses_public_idx ON public.restaurant_businesses (slug)
  WHERE review_status = 'verified' AND published_at IS NOT NULL;

CREATE TABLE public.restaurant_menu_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurant_businesses(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Menu' CHECK (length(btrim(category)) BETWEEN 1 AND 80),
  name_en text NOT NULL CHECK (length(btrim(name_en)) BETWEEN 1 AND 120),
  name_th text CHECK (name_th IS NULL OR length(name_th) <= 120),
  description_en text NOT NULL DEFAULT '' CHECK (length(description_en) <= 500),
  description_th text NOT NULL DEFAULT '' CHECK (length(description_th) <= 500),
  -- Pro will eventually use restaurant-approved translations. Never silently
  -- expose generated text as an approved translation.
  approved_translations jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(approved_translations) = 'object'),
  price_thb numeric(10,2) NOT NULL CHECK (price_thb >= 0 AND price_thb <= 100000),
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurant_menu_entries_order_idx
  ON public.restaurant_menu_entries (restaurant_id, sort_order, created_at);

ALTER TABLE public.restaurant_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_entries ENABLE ROW LEVEL SECURITY;
-- No direct INSERT, UPDATE or DELETE grants or policies for public/browser
-- roles. All writes pass through server-side owner checks and admin key.
REVOKE ALL ON TABLE public.restaurant_businesses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.restaurant_menu_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.restaurant_businesses TO authenticated;
GRANT SELECT ON public.restaurant_menu_entries TO authenticated;
GRANT ALL ON public.restaurant_businesses, public.restaurant_menu_entries TO service_role;

CREATE POLICY "business owners read only own drafts"
 ON public.restaurant_businesses FOR SELECT TO authenticated
 USING (owner_id = (select auth.uid()));
CREATE POLICY "business owners read only own menu rows"
 ON public.restaurant_menu_entries FOR SELECT TO authenticated
 USING (
   EXISTS (
     SELECT 1 FROM public.restaurant_businesses b
     WHERE b.id = restaurant_menu_entries.restaurant_id
       AND b.owner_id = (select auth.uid())
   )
 );
-- The anon role has NO table access. A dedicated public server function
-- returns a whitelisted projection of verified, published menus only.

-- Atomic admin verification: service_role access ONLY, and a DB-backed
-- app_role=admin check. New places, memberships and official profiles
-- are created together or not at all.
CREATE FUNCTION public.admin_review_business_draft(
  _business_id uuid, _reviewer_id uuid, _approve boolean, _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  b public.restaurant_businesses%ROWTYPE;
  new_place uuid;
BEGIN
  IF NOT public.has_role(_reviewer_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator permission is required';
  END IF;
  SELECT * INTO b FROM public.restaurant_businesses
  WHERE id = _business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business draft not found'; END IF;
  IF b.review_status <> 'submitted' THEN
    RAISE EXCEPTION 'Only submitted businesses can be reviewed';
  END IF;
  IF _approve THEN
    INSERT INTO public.places (name, address, created_by, status)
    VALUES (b.name, b.area_label, b.owner_id, 'approved')
    RETURNING id INTO new_place;
    INSERT INTO public.restaurant_memberships (place_id, user_id, role)
    VALUES (new_place, b.owner_id, 'owner');
    INSERT INTO public.restaurant_profiles (
      place_id, is_verified, official_description, updated_by,
      subscription_tier, subscription_status
    ) VALUES (
      new_place, true, b.description, b.owner_id, 'free', 'free'
    );
    UPDATE public.restaurant_businesses SET
      review_status = 'verified', verified_place_id = new_place,
      reviewed_at = now(), reviewed_by = _reviewer_id,
      review_note = left(coalesce(_note,''),1000), updated_at = now()
    WHERE id = _business_id;
    RETURN new_place;
  END IF;
  UPDATE public.restaurant_businesses SET
    review_status = 'rejected', reviewed_at = now(),
    reviewed_by = _reviewer_id, review_note = left(coalesce(_note,''),1000),
    updated_at = now()
  WHERE id = _business_id;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_business_draft(uuid,uuid,boolean,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_business_draft(uuid,uuid,boolean,text)
  TO service_role;

COMMIT;
