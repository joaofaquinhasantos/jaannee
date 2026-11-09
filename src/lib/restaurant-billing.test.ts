import { describe,expect,it } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  parseStripeSubscriptionEvent,
  verifyStripeSignature,
} from "./stripe-billing.server";

const sql=readFileSync(new URL("../../supabase/migrations/20261109085000_restaurant_stripe_subscription_tracking.sql",import.meta.url),"utf8");
const code=readFileSync(new URL("./restaurant-billing.functions.ts",import.meta.url),"utf8");
const webhook=readFileSync(new URL("../routes/api/billing/stripe-webhook.ts",import.meta.url),"utf8");
const panel=readFileSync(new URL("../components/BusinessBillingPanel.tsx",import.meta.url),"utf8");

function sampleEvent(type="customer.subscription.updated",priceId="price_pro") {
  return {
    id:"evt_abc12345",type,created:1700000000,
    data:{object:{
      id:"sub_123abc",customer:"cus_123abc",status:"active",trial_end:null,
      items:{data:[{price:{id:priceId}}]},
    }},
  };
}
describe("Stripe subscription lifecycle security",()=>{
  it("verifies raw Stripe HMAC, timestamp and hexadecimal signature",()=>{
    const secret="whsec_test_key";
    const body=JSON.stringify(sampleEvent());
    const ts=1700000000;
    const signature=createHmac("sha256",secret).update(ts+"."+body).digest("hex");
    const header="t="+ts+",v1="+signature;
    expect(verifyStripeSignature(body,header,secret,ts*1000)).toBe(true);
    expect(verifyStripeSignature(body+" ",header,secret,ts*1000)).toBe(false);
    expect(verifyStripeSignature(body,header,secret,(ts+301)*1000)).toBe(false);
    expect(verifyStripeSignature(body,header.replace("v1","v0"),secret,ts*1000)).toBe(false);
    expect(verifyStripeSignature(body,null,secret,ts*1000)).toBe(false);
    expect(verifyStripeSignature(body,header,"wrong",ts*1000)).toBe(false);
  });

  it("grants paid tiers only for exact configured Stripe price IDs",()=>{
    const priceMap={pro:"price_pro",growth:"price_growth"};
    expect(parseStripeSubscriptionEvent(sampleEvent(),priceMap)?.tier).toBe("pro");
    expect(parseStripeSubscriptionEvent(sampleEvent("customer.subscription.created","price_growth"),priceMap)?.tier).toBe("growth");
    expect(()=>parseStripeSubscriptionEvent(sampleEvent("customer.subscription.updated","price_unknown"),priceMap)).toThrow("unrecognized");
    expect(parseStripeSubscriptionEvent(sampleEvent("checkout.session.completed"),priceMap)).toBe(null);
    const canceled=sampleEvent("customer.subscription.deleted");
    canceled.data.object.status="canceled";
    expect(parseStripeSubscriptionEvent(canceled,priceMap)?.status).toBe("canceled");
  });

  it("keeps subscription mapping and event receipts private, idempotent and ordered",()=>{
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON public.restaurant_billing_accounts FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("REVOKE ALL ON public.restaurant_billing_events FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("ON CONFLICT (stripe_event_id) DO NOTHING");
    expect(sql).toContain("_event_created < account.last_event_created");
    expect(sql).toContain("Unverified restaurant cannot receive paid features");
    expect(sql).toContain("CASE WHEN _plan = 'growth' THEN 'growth' ELSE 'free' END");
    expect(sql).toContain("TO service_role");
  });

  it("does not let browser-selected plan or Checkout redirect grant privileges",()=>{
    expect(code).toContain("ownedVerifiedBusiness");
    expect(code).toContain("createStripeSubscriptionCheckout");
    expect(code).not.toContain("plan_tier =");
    expect(webhook).toContain('verifyStripeSignature(');
    expect(webhook).toContain("apply_restaurant_stripe_event");
    expect(webhook).toContain('new Response("Invalid signature",{status:400})');
    expect(webhook).toContain('new Response("Retry later",{status:503})');
    expect(panel).toContain("No card details or payment requests");
    expect(panel).toContain("signed subscription");
  });

  it("requires explicit server-side billing enablement before any Stripe call",()=>{
    const stripe=readFileSync(new URL("./stripe-billing.server.ts",import.meta.url),"utf8");
    expect(stripe).toContain('process.env.ENABLE_RESTAURANT_BILLING==="true"');
    expect(stripe).toContain('process.env.ENABLE_LIVE_STRIPE==="true"');
    expect(stripe).toContain('stripeBillingConfig()');
    expect(stripe).toContain("checkout.stripe.com");
    expect(stripe).toContain("billing.stripe.com");
    expect(stripe).not.toMatch(/VITE_STRIPE_SECRET|NEXT_PUBLIC_STRIPE_SECRET/);
  });
});
