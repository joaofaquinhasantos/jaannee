-- Subscription lifecycle is managed only by verified Stripe events.
-- No browser role can grant plans, alter customer IDs or replay webhooks.
BEGIN;
CREATE TABLE public.restaurant_billing_accounts (
  business_id uuid PRIMARY KEY REFERENCES public.restaurant_businesses(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE CHECK (length(stripe_customer_id) BETWEEN 6 AND 120),
  stripe_subscription_id text UNIQUE CHECK (stripe_subscription_id IS NULL OR length(stripe_subscription_id) BETWEEN 6 AND 120),
  stripe_price_id text CHECK (stripe_price_id IS NULL OR length(stripe_price_id) BETWEEN 6 AND 120),
  last_event_created bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.restaurant_billing_events (
  stripe_event_id text PRIMARY KEY CHECK (length(stripe_event_id) BETWEEN 6 AND 150),
  business_id uuid NOT NULL REFERENCES public.restaurant_businesses(id) ON DELETE CASCADE,
  stripe_event_created bigint NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurant_billing_events_business_idx
  ON public.restaurant_billing_events (business_id, processed_at DESC);
ALTER TABLE public.restaurant_billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_billing_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.restaurant_billing_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.restaurant_billing_accounts TO service_role;
GRANT ALL ON public.restaurant_billing_events TO service_role;

CREATE FUNCTION public.apply_restaurant_stripe_event(
  _event_id text,
  _event_created bigint,
  _customer_id text,
  _subscription_id text,
  _price_id text,
  _plan text,
  _status text,
  _trial_ends_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  account public.restaurant_billing_accounts%ROWTYPE;
  p public.restaurant_businesses%ROWTYPE;
  inserted text;
BEGIN
  IF _event_id !~ '^evt_[A-Za-z0-9]+$'
     OR _event_created <= 0 OR _event_created > extract(epoch from now() + interval '5 minutes')::bigint
     OR _customer_id !~ '^cus_[A-Za-z0-9]+$'
     OR _subscription_id !~ '^sub_[A-Za-z0-9]+$'
     OR _price_id !~ '^price_[A-Za-z0-9]+$'
     OR _plan NOT IN ('free','pro','growth')
     OR _status NOT IN ('free','trialing','active','past_due','canceled')
  THEN
    RAISE EXCEPTION 'Invalid Stripe subscription event';
  END IF;

  SELECT * INTO account FROM public.restaurant_billing_accounts
  WHERE stripe_customer_id = _customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown Stripe billing customer'; END IF;

  SELECT * INTO p FROM public.restaurant_businesses
  WHERE id = account.business_id FOR UPDATE;
  IF NOT FOUND OR p.review_status <> 'verified' OR p.verified_place_id IS NULL THEN
    RAISE EXCEPTION 'Unverified restaurant cannot receive paid features';
  END IF;

  INSERT INTO public.restaurant_billing_events
    (stripe_event_id, business_id, stripe_event_created)
  VALUES (_event_id,account.business_id,_event_created)
  ON CONFLICT (stripe_event_id) DO NOTHING
  RETURNING stripe_event_id INTO inserted;
  IF inserted IS NULL THEN RETURN false; END IF;

  IF _event_created < account.last_event_created THEN RETURN false; END IF;

  UPDATE public.restaurant_billing_accounts SET
    stripe_subscription_id = _subscription_id,
    stripe_price_id = _price_id,
    last_event_created = _event_created,
    updated_at = now()
  WHERE business_id = account.business_id;

  UPDATE public.restaurant_businesses SET
    plan_tier = _plan,
    billing_status = _status,
    trial_ends_at = _trial_ends_at,
    updated_at = now()
  WHERE id = account.business_id;

  -- Legacy Growth-only features read restaurant_profiles.
  -- Pro is not Growth; do not accidentally grant old outreach privileges.
  UPDATE public.restaurant_profiles SET
    subscription_tier = CASE WHEN _plan = 'growth' THEN 'growth' ELSE 'free' END,
    subscription_status = CASE WHEN _plan = 'growth' THEN _status ELSE 'free' END,
    trial_ends_at = CASE WHEN _plan = 'growth' THEN _trial_ends_at ELSE NULL END,
    updated_at = now()
  WHERE place_id = p.verified_place_id;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_restaurant_stripe_event(text,bigint,text,text,text,text,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_restaurant_stripe_event(text,bigint,text,text,text,text,text,timestamptz)
  TO service_role;
COMMIT;
