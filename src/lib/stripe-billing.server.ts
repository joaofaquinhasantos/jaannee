// SERVER ONLY — Stripe API keys must never be accessible in React bundles.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const subscriptionEvent = z.object({
  id: z.string().min(7),
  type: z.string(),
  created: z.number().int().positive(),
  data: z.object({
    object: z.object({
      id: z.string().startsWith("sub_"),
      customer: z.string().startsWith("cus_"),
      status: z.string(),
      trial_end: z.number().int().nullable().optional(),
      items: z.object({
        data: z.array(z.object({
          price: z.object({ id: z.string() }),
        })).min(1),
      }),
    }),
  }),
});

export function stripeBillingConfig() {
  const key=process.env.STRIPE_SECRET_KEY;
  const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET;
  const pro=process.env.STRIPE_PRO_PRICE_ID;
  const growth=process.env.STRIPE_GROWTH_PRICE_ID;
  const origin=process.env.STRIPE_CHECKOUT_RETURN_ORIGIN;
  const enabled=process.env.ENABLE_RESTAURANT_BILLING==="true";
  if(!enabled || !key || !webhookSecret || !pro || !growth || !origin) {
    throw new Error("Restaurant billing is not enabled for this deployment.");
  }
  if(!key.startsWith("sk_test_") && !(key.startsWith("sk_live_") &&
     process.env.ENABLE_LIVE_STRIPE==="true")) {
    throw new Error("Live Stripe requires a separate explicit enable switch.");
  }
  if(!pro.startsWith("price_") || !growth.startsWith("price_") || pro===growth) {
    throw new Error("Stripe subscription prices are not configured.");
  }
  const u=new URL(origin);
  if(u.protocol!=="https:" || u.pathname!=="/" || u.search || u.hash) {
    throw new Error("A canonical HTTPS return origin is required.");
  }
  return {key,webhookSecret,pro,growth,origin:u.origin};
}

export function verifyStripeSignature(payload:string, header:string|null,secret:string,now=Date.now()):boolean {
  if(!header || payload.length>2_000_000 || !secret) return false;
  const tokens=new Map<string,string[]>();
  for(const part of header.split(",")) {
    const split=part.trim().indexOf("=");
    if(split<1)continue;
    const k=part.trim().slice(0,split);
    const v=part.trim().slice(split+1);
    tokens.set(k,[...(tokens.get(k)??[]),v]);
  }
  const timestamp=Number(tokens.get("t")?.[0]);
  if(!Number.isInteger(timestamp) || Math.abs(Math.floor(now/1000)-timestamp)>300) return false;
  const signatures=tokens.get("v1")??[];
  if(!signatures.length) return false;
  const expected=createHmac("sha256",secret).update(timestamp+"."+payload,"utf8").digest();
  return signatures.some(sig=>{
    if(!/^[a-fA-F0-9]{64}$/.test(sig))return false;
    const provided=Buffer.from(sig,"hex");
    return provided.length===expected.length && timingSafeEqual(provided,expected);
  });
}

async function stripeApi<T>(path:string,params:Record<string,string>,key:string):Promise<T> {
  const r=await fetch("https://api.stripe.com/v1/"+path,{
    method:"POST",
    headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams(params).toString(),
    signal:AbortSignal.timeout(20_000),
  });
  if(!r.ok)throw new Error("Stripe is temporarily unavailable.");
  return await r.json() as T;
}

export async function createStripeCustomer(businessId:string,businessName:string) {
  const config=stripeBillingConfig();
  const data=await stripeApi<{id:string}>("customers",{
    description:"JaanNee restaurant "+businessName.slice(0,80),
    "metadata[jaannee_business_id]":businessId,
  },config.key);
  if(!data.id?.startsWith("cus_"))throw new Error("Stripe did not create a valid customer.");
  return data.id;
}

export async function createStripeSubscriptionCheckout(
  businessId:string,customerId:string,tier:"pro"|"growth",
):Promise<string> {
  const config=stripeBillingConfig();
  const price=tier==="pro"?config.pro:config.growth;
  const result=await stripeApi<{url:string;id:string}>("checkout/sessions",{
    mode:"subscription",
    customer:customerId,
    client_reference_id:businessId,
    "line_items[0][price]":price,
    "line_items[0][quantity]":"1",
    "subscription_data[metadata][jaannee_business_id]":businessId,
    "metadata[jaannee_business_id]":businessId,
    success_url:config.origin+"/business?billing=success",
    cancel_url:config.origin+"/business?billing=cancelled",
  },config.key);
  const url=new URL(result.url);
  if(url.protocol!=="https:" || url.hostname!=="checkout.stripe.com") {
    throw new Error("Stripe returned an unexpected checkout destination.");
  }
  return url.toString();
}

export async function createStripeBillingPortal(customerId:string):Promise<string> {
  const config=stripeBillingConfig();
  const result=await stripeApi<{url:string}>("billing_portal/sessions",{
    customer:customerId,
    return_url:config.origin+"/business",
  },config.key);
  const url=new URL(result.url);
  if(url.protocol!=="https:" || url.hostname!=="billing.stripe.com") {
    throw new Error("Stripe returned an unexpected billing portal destination.");
  }
  return url.toString();
}

export type SubscriptionEvent = {
  id:string;
  created:number;
  customerId:string;
  subscriptionId:string;
  priceId:string;
  tier:"pro"|"growth";
  status:"trialing"|"active"|"past_due"|"canceled";
  trialEnd:string|null;
};

/** Only a verified Stripe price ID may grant an entitlement. */
export function parseStripeSubscriptionEvent(raw:unknown,prices:{pro:string;growth:string}):SubscriptionEvent|null {
  const obj=raw && typeof raw==="object" ? raw as Record<string,unknown> : null;
  if(!obj || !["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(String(obj.type??"")))return null;
  const parsed=subscriptionEvent.parse(raw);
  const p=parsed.data.object;
  const priceId=p.items.data[0].price.id;
  const tier=priceId===prices.pro?"pro":priceId===prices.growth?"growth":null;
  if(!tier)throw new Error("Subscription contains an unrecognized product price.");
  const status:persistentStatus=p.status==="active"?"active":
    p.status==="trialing"?"trialing":
    p.status==="canceled"?"canceled":"past_due";
  return {
    id:parsed.id,
    created:parsed.created,
    customerId:p.customer,
    subscriptionId:p.id,
    priceId,tier,status,
    trialEnd:p.trial_end?new Date(p.trial_end*1000).toISOString():null,
  };
}
type persistentStatus="trialing"|"active"|"past_due"|"canceled";
