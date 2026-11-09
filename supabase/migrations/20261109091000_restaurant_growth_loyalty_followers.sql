-- Restaurant follows are explicit diner preferences. Following NEVER
-- automatically consents to marketing messages or vouchers.
BEGIN;
CREATE TABLE public.restaurant_followers (
  business_id uuid NOT NULL REFERENCES public.restaurant_businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_vouchers boolean NOT NULL DEFAULT false,
  allow_messages boolean NOT NULL DEFAULT false,
  followed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(business_id,user_id)
);
CREATE INDEX restaurant_followers_user_idx ON public.restaurant_followers(user_id);
ALTER TABLE public.restaurant_followers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_followers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.restaurant_followers TO authenticated;
GRANT ALL ON public.restaurant_followers TO service_role;
CREATE POLICY "diner views own restaurant follows" ON public.restaurant_followers
  FOR SELECT TO authenticated USING (user_id=(select auth.uid()));

CREATE TABLE public.restaurant_growth_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.restaurant_businesses(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('promotion','voucher')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 80),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 3 AND 320),
  discount_percent integer CHECK(discount_percent IS NULL OR discount_percent BETWEEN 1 AND 90),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_end_after_start CHECK(ends_at > starts_at AND ends_at <= starts_at + interval '90 days'),
  CONSTRAINT voucher_discount_required CHECK(kind <> 'voucher' OR discount_percent IS NOT NULL)
);
CREATE INDEX restaurant_growth_campaigns_active_idx ON public.restaurant_growth_campaigns
 (business_id,status,starts_at,ends_at);
ALTER TABLE public.restaurant_growth_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_growth_campaigns FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.restaurant_growth_campaigns TO authenticated;
GRANT ALL ON public.restaurant_growth_campaigns TO service_role;
CREATE POLICY "verified owner reads own campaigns" ON public.restaurant_growth_campaigns
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.restaurant_businesses b
      WHERE b.id=business_id AND b.owner_id=(select auth.uid()))
  );

CREATE TABLE public.restaurant_voucher_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.restaurant_growth_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_code text NOT NULL UNIQUE CHECK(length(claim_code) BETWEEN 10 AND 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(campaign_id,user_id),
  CONSTRAINT voucher_expiry_after_creation CHECK(expires_at > created_at),
  CONSTRAINT voucher_redemption_before_expiry CHECK(redeemed_at IS NULL OR redeemed_at <= expires_at)
);
CREATE INDEX restaurant_voucher_claims_user_idx ON public.restaurant_voucher_claims(user_id,created_at DESC);
ALTER TABLE public.restaurant_voucher_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_voucher_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.restaurant_voucher_claims TO authenticated;
GRANT ALL ON public.restaurant_voucher_claims TO service_role;
CREATE POLICY "diners view own voucher claims" ON public.restaurant_voucher_claims
  FOR SELECT TO authenticated USING(user_id=(select auth.uid()));

CREATE TABLE public.restaurant_loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.restaurant_businesses(id) ON DELETE CASCADE,
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 80),
  reward_description text NOT NULL CHECK(length(btrim(reward_description)) BETWEEN 3 AND 200),
  visits_required integer NOT NULL CHECK(visits_required BETWEEN 3 AND 12),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_loyalty_programs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_loyalty_programs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.restaurant_loyalty_programs TO authenticated;
GRANT ALL ON public.restaurant_loyalty_programs TO service_role;
CREATE POLICY "business owner reads loyalty configuration" ON public.restaurant_loyalty_programs
 FOR SELECT TO authenticated USING(
  EXISTS(SELECT 1 FROM public.restaurant_businesses b
    WHERE b.id=business_id AND b.owner_id=(select auth.uid()))
 );

CREATE TABLE public.restaurant_loyalty_cards (
  program_id uuid NOT NULL REFERENCES public.restaurant_loyalty_programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visits integer NOT NULL DEFAULT 0 CHECK(visits BETWEEN 0 AND 12),
  reward_ready boolean NOT NULL DEFAULT false,
  redeemed_count integer NOT NULL DEFAULT 0 CHECK(redeemed_count >= 0),
  last_visit_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(program_id,user_id)
);
ALTER TABLE public.restaurant_loyalty_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_loyalty_cards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.restaurant_loyalty_cards TO authenticated;
GRANT ALL ON public.restaurant_loyalty_cards TO service_role;
CREATE POLICY "diners view own loyalty cards" ON public.restaurant_loyalty_cards
  FOR SELECT TO authenticated USING(user_id=(select auth.uid()));

CREATE TABLE public.restaurant_loyalty_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.restaurant_loyalty_programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('visit','redeem')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurant_loyalty_actions_program_idx ON public.restaurant_loyalty_actions(program_id,user_id,created_at);
ALTER TABLE public.restaurant_loyalty_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_loyalty_actions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.restaurant_loyalty_actions TO service_role;

-- Atomic, staff-confirmed visit/reward; must be called only through the
-- authenticated server after validating the guest's signed short-lived code.
CREATE FUNCTION public.apply_restaurant_loyalty_action(
  _program_id uuid,_user_id uuid,_actor_id uuid,_kind text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE
  card public.restaurant_loyalty_cards%ROWTYPE;
  program public.restaurant_loyalty_programs%ROWTYPE;
  business public.restaurant_businesses%ROWTYPE;
  new_visits integer;
  new_reward boolean;
BEGIN
  IF _kind NOT IN ('visit','redeem') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  SELECT * INTO program FROM public.restaurant_loyalty_programs WHERE id=_program_id AND active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty program unavailable'; END IF;
  SELECT * INTO business FROM public.restaurant_businesses WHERE id=program.business_id;
  IF NOT FOUND OR business.owner_id<>_actor_id OR business.review_status<>'verified'
    OR business.plan_tier<>'growth'
    OR NOT (business.billing_status='active' OR
      (business.billing_status='trialing' AND business.trial_ends_at>now()))
  THEN RAISE EXCEPTION 'Verified Growth restaurant access required'; END IF;
  SELECT * INTO card FROM public.restaurant_loyalty_cards
    WHERE program_id=_program_id AND user_id=_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer must join the loyalty program'; END IF;

  IF _kind='visit' THEN
    IF card.reward_ready THEN RAISE EXCEPTION 'Reward is ready for redemption'; END IF;
    IF card.last_visit_at IS NOT NULL AND card.last_visit_at>now()-interval '20 hours'
      THEN RAISE EXCEPTION 'Visit stamp already issued within 20 hours'; END IF;
    new_visits=card.visits+1;
    new_reward=new_visits>=program.visits_required;
    UPDATE public.restaurant_loyalty_cards SET visits=new_visits,
      reward_ready=new_reward,last_visit_at=now(),updated_at=now()
    WHERE program_id=_program_id AND user_id=_user_id;
  ELSE
    IF NOT card.reward_ready THEN RAISE EXCEPTION 'Reward not yet earned'; END IF;
    new_visits=0;
    new_reward=false;
    UPDATE public.restaurant_loyalty_cards SET visits=0,reward_ready=false,
      redeemed_count=redeemed_count+1,updated_at=now()
    WHERE program_id=_program_id AND user_id=_user_id;
  END IF;
  INSERT INTO public.restaurant_loyalty_actions(program_id,user_id,actor_id,kind)
    VALUES(_program_id,_user_id,_actor_id,_kind);
  RETURN jsonb_build_object('visits',new_visits,'reward_ready',new_reward);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_restaurant_loyalty_action(uuid,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_restaurant_loyalty_action(uuid,uuid,uuid,text)
 TO service_role;
COMMIT;
