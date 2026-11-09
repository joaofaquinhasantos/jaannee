import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePaidBoostEvent } from "./sponsored-billing.server";

const migration=readFileSync(
  new URL("../../supabase/migrations/20261109094500_reviewed_paid_sponsored_boosts.sql",import.meta.url),"utf8",
);
const actions=readFileSync(new URL("./sponsored-boosts.functions.ts",import.meta.url),"utf8");
const checkout=readFileSync(new URL("./sponsored-billing.server.ts",import.meta.url),"utf8");
const webhook=readFileSync(new URL("../routes/api/billing/stripe-webhook.ts",import.meta.url),"utf8");
const index=readFileSync(new URL("../routes/index.tsx",import.meta.url),"utf8");
const socialFeed=readFileSync(new URL("../components/StitchSocialNewsFeed.tsx",import.meta.url),"utf8");
const card=readFileSync(new URL("../components/SponsoredDiscoveryPlacement.tsx",import.meta.url),"utf8");
const owner=readFileSync(new URL("../components/BusinessSponsoredPanel.tsx",import.meta.url),"utf8");
const reviewer=readFileSync(new URL("../routes/_authenticated/sponsored-reviews.tsx",import.meta.url),"utf8");

const ids={
  businessId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  boostId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};
function event(){
  return {
    id:"evt_1234ABC",type:"checkout.session.completed",
    data:{object:{
      id:"cs_test_Abc123",mode:"payment",payment_status:"paid",
      payment_intent:"pi_abc1234",amount_total:59000,currency:"thb",
      client_reference_id:ids.boostId,
      metadata:{jaannee_boost_id:ids.boostId,jaannee_business_id:ids.businessId},
    }},
  };
}
describe("restaurant sponsored advertising safeguards",()=>{
  it("parses only paid one-time sessions with verified boost references",()=>{
    const parsed=parsePaidBoostEvent(event());
    expect(parsed).toMatchObject({eventId:"evt_1234ABC",boostId:ids.boostId,businessId:ids.businessId,
      sessionId:"cs_test_Abc123",amountTotal:59000,currency:"thb"});
    const subscription={...event(),data:{object:{...event().data.object,mode:"subscription"}}};
    expect(parsePaidBoostEvent(subscription)).toBeNull();
    const unpaid={...event(),data:{object:{...event().data.object,payment_status:"unpaid"}}};
    expect(parsePaidBoostEvent(unpaid)).toBeNull();
    const spoof={...event(),data:{object:{...event().data.object,client_reference_id:ids.businessId}}};
    expect(()=>parsePaidBoostEvent(spoof)).toThrow("Mismatched");
    expect(parsePaidBoostEvent({type:"customer.subscription.updated"})).toBeNull();
  });
  it("requires a reviewed sponsorship AND confirmed Stripe payment before a public listing",()=>{
    expect(migration).toContain("paid_boost_requires_review");
    expect(migration).toContain("boost_schedule_requires_payment");
    expect(migration).toContain("review_status='approved' AND payment_status='paid'");
    expect(migration).toContain("Sponsorship is not approved or already paid");
    expect(migration).toContain("Restaurant must be verified and published");
    expect(actions).toContain('.eq("review_status","approved").eq("payment_status","paid")');
    expect(actions).toContain('process.env.ENABLE_SPONSORED_BOOSTS!=="true"');
    expect(actions).toContain('disclosure:"Sponsored"');
    expect(actions).toContain('.eq("restaurant.review_status","verified")');
    expect(actions).toContain(".not(\"restaurant.published_at\",\"is\",null)");
  });
  it("enforces admin-only review and forbids anonymous subscription activation",()=>{
    expect(migration).toContain("public.has_role(_reviewer_id,'admin'::public.app_role)");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.review_restaurant_sponsored_boost");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.activate_paid_restaurant_boost");
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("REVOKE ALL ON public.restaurant_sponsored_boosts FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(actions).toContain("adminOnly(context)");
    expect(actions).toContain("review_restaurant_sponsored_boost");
    expect(reviewer).toContain("Sponsored content review");
  });
  it("verifies provider's exact Stripe price and amount before activating a boost",()=>{
    expect(checkout).toContain('process.env.ENABLE_SPONSORED_BOOSTS!=="true"');
    expect(checkout).toContain('process.env.ENABLE_LIVE_STRIPE==="true"');
    expect(checkout).toContain("verifyBoostCheckoutLineItem");
    expect(checkout).toContain("items.data[0]?.price.id!==cfg.price");
    expect(checkout).toContain("items.data[0]?.amount_total!==event.amountTotal");
    expect(webhook).toContain("verifyStripeSignature(");
    expect(webhook).toContain("activate_paid_restaurant_boost");
    expect(webhook).toContain('checkout?.mode!=="payment"');
    expect(webhook).toContain("verifyBoostCheckoutLineItem(paid)");
    expect(owner).toContain("const enabled=false");
  });
  it("ends sponsored exposure after full refunds or a disputed payment",()=>{
    expect(migration).toContain("revoke_restaurant_sponsored_boost");
    expect(migration).toContain("payment_status=_reason");
    expect(migration).toContain("starts_at=NULL, ends_at=NULL");
    expect(migration).toContain("stripe_payment_intent_id text UNIQUE");
    expect(webhook).toContain('webhookEvent?.type==="charge.refunded"');
    expect(webhook).toContain('webhookEvent?.type==="charge.dispute.created"');
    expect(webhook).toContain('details?.refunded!==true');
  });
  it("separates the sponsored slot from rankings and clearly discloses payment",()=>{
    expect(index).toContain("StitchSocialNewsFeed");
    expect(socialFeed).toContain("<SponsoredDiscoveryPlacement/>");
    expect(socialFeed).toContain("forYouFeed");
    expect(socialFeed).toContain("mostComparedFeed");
    expect(card).toContain('aria-label="Paid restaurant advertisement"');
    expect(card).toContain("Sponsored");
    expect(card).toContain("not a diner recommendation or ranking");
    expect(card).not.toContain("elo");
    expect(card).not.toContain("comparisons_count");
    expect(actions).not.toMatch(/\.from\("dishes"\)\.update\(/);
    expect(actions).not.toMatch(/\.from\("dish_comparisons"\)/);
  });
});
