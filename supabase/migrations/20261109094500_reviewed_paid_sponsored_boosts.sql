-- Paid placements are a separate advertising product. They NEVER affect
-- dishes.elo, dishes.comparisons_count, recommendations, or organic ordering.
-- An owner drafts; an admin approves; only then can Stripe checkout begin.
-- A signed, price-verified Stripe event activates a 7-day placement.
BEGIN;

CREATE TABLE public.restaurant_sponsored_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.restaurant_businesses(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_campaign_id uuid REFERENCES public.restaurant_growth_campaigns(id) ON DELETE SET NULL,
  headline text NOT NULL CHECK (length(btrim(headline)) BETWEEN 5 AND 90),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 5 AND 260),
  target_area_slug text CHECK (target_area_slug IS NULL OR target_area_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  target_category_slug text CHECK (target_category_slug IS NULL OR target_category_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft','submitted','approved','rejected')),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note text,
  reviewed_at timestamptz,
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid','refunded')),
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_event_id text UNIQUE,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_boost_requires_review CHECK (
    payment_status <> 'paid' OR
    (review_status = 'approved' AND paid_at IS NOT NULL
      AND stripe_checkout_session_id IS NOT NULL
      AND stripe_payment_event_id IS NOT NULL)
  ),
  CONSTRAINT boost_schedule_requires_payment CHECK (
    (starts_at IS NULL AND ends_at IS NULL)
    OR
    (review_status='approved' AND payment_status='paid'
      AND starts_at IS NOT NULL AND ends_at=starts_at+interval '7 days')
  )
);
CREATE INDEX restaurant_sponsored_boosts_public_idx ON public.restaurant_sponsored_boosts
  (starts_at, ends_at) WHERE review_status='approved' AND payment_status='paid';
CREATE INDEX restaurant_sponsored_boosts_business_idx ON public.restaurant_sponsored_boosts
  (business_id, created_at DESC);

ALTER TABLE public.restaurant_sponsored_boosts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_sponsored_boosts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.restaurant_sponsored_boosts TO authenticated;
GRANT ALL ON public.restaurant_sponsored_boosts TO service_role;
CREATE POLICY "business owners can read own sponsorship drafts"
  ON public.restaurant_sponsored_boosts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.restaurant_businesses b
      WHERE b.id=business_id AND b.owner_id=(select auth.uid()))
  );

-- Admin action is transactional, service-only and requires DB-backed app_role
-- authorization. Payment is impossible before approval.
CREATE FUNCTION public.review_restaurant_sponsored_boost(
  _boost_id uuid,_reviewer_id uuid,_approve boolean,_note text DEFAULT ''
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE
  boost public.restaurant_sponsored_boosts%ROWTYPE;
BEGIN
  IF NOT public.has_role(_reviewer_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator authorization required';
  END IF;
  SELECT * INTO boost FROM public.restaurant_sponsored_boosts
    WHERE id=_boost_id FOR UPDATE;
  IF NOT FOUND OR boost.review_status <> 'submitted' THEN
    RAISE EXCEPTION 'Sponsorship draft not available for review';
  END IF;
  IF boost.payment_status <> 'unpaid' THEN
    RAISE EXCEPTION 'Cannot review a paid sponsorship';
  END IF;
  UPDATE public.restaurant_sponsored_boosts SET
    review_status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    reviewer_id=_reviewer_id,
    review_note=left(coalesce(_note,''),1000),
    reviewed_at=now(),
    updated_at=now()
    WHERE id=_boost_id;
  RETURN _approve;
END;
$$;
REVOKE ALL ON FUNCTION public.review_restaurant_sponsored_boost(uuid,uuid,boolean,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_restaurant_sponsored_boost(uuid,uuid,boolean,text)
  TO service_role;

-- Invoked only after independent Stripe signature + provider line-item
-- verification. Deduplicated by event id and Checkout session id.
CREATE FUNCTION public.activate_paid_restaurant_boost(
  _boost_id uuid,_business_id uuid,_session_id text,_event_id text,
  _payment_intent_id text,_amount_total bigint,_currency text
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE
  boost public.restaurant_sponsored_boosts%ROWTYPE;
  b public.restaurant_businesses%ROWTYPE;
BEGIN
  IF _session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$'
    OR _event_id !~ '^evt_[A-Za-z0-9]+$'
    OR _payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
    OR _currency <> 'thb' OR _amount_total <= 0 THEN
    RAISE EXCEPTION 'Invalid paid sponsorship event';
  END IF;
  SELECT * INTO boost FROM public.restaurant_sponsored_boosts
    WHERE id=_boost_id AND business_id=_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sponsored promotion does not exist'; END IF;
  IF boost.stripe_payment_event_id=_event_id AND boost.stripe_checkout_session_id=_session_id
    THEN RETURN false; END IF;
  IF boost.review_status<>'approved' OR boost.payment_status<>'unpaid' THEN
    RAISE EXCEPTION 'Sponsorship is not approved or already paid';
  END IF;
  SELECT * INTO b FROM public.restaurant_businesses
    WHERE id=_business_id FOR UPDATE;
  IF NOT FOUND OR b.review_status<>'verified' OR b.verified_place_id IS NULL
    OR b.published_at IS NULL THEN
    RAISE EXCEPTION 'Restaurant must be verified and published';
  END IF;
  UPDATE public.restaurant_sponsored_boosts SET
    payment_status='paid',stripe_checkout_session_id=_session_id,
    stripe_payment_event_id=_event_id,stripe_payment_intent_id=_payment_intent_id,
    paid_at=now(),starts_at=now(),ends_at=now()+interval '7 days',
    updated_at=now()
  WHERE id=_boost_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_paid_restaurant_boost(uuid,uuid,text,text,text,bigint,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_restaurant_boost(uuid,uuid,text,text,text,bigint,text)
  TO service_role;
COMMIT;
