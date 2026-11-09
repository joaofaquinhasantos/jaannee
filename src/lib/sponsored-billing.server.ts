// SERVER ONLY. Paid sponsored placement is disabled unless Stripe test
// configuration AND a separate explicit enable switch are set.
import { z } from "zod";

const boostEvent = z.object({
  id: z.string().regex(/^evt_[A-Za-z0-9]+$/),
  type: z.literal("checkout.session.completed"),
  data: z.object({ object: z.object({
    id: z.string().regex(/^cs_(?:test|live)_[A-Za-z0-9]+$/),
    mode: z.literal("payment"),
    payment_status: z.literal("paid"),
    payment_intent: z.string().regex(/^pi_[A-Za-z0-9]+$/),
    amount_total: z.number().int().positive(),
    currency: z.literal("thb"),
    client_reference_id: z.string().uuid(),
    metadata: z.object({
      jaannee_boost_id: z.string().uuid(),
      jaannee_business_id: z.string().uuid(),
    }),
  }) }),
});

export type PaidBoostEvent = {
  eventId: string;
  boostId: string;
  businessId: string;
  sessionId: string;
  paymentIntentId: string;
  amountTotal: number;
  currency: "thb";
};

export function sponsoredBoostConfig() {
  const key=process.env.STRIPE_SECRET_KEY;
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  const price=process.env.STRIPE_BOOST_PRICE_ID;
  const origin=process.env.STRIPE_CHECKOUT_RETURN_ORIGIN;
  if (process.env.ENABLE_SPONSORED_BOOSTS!=="true" || !key || !secret || !price || !origin) {
    throw new Error("Sponsored boosts have not been activated.");
  }
  if (!(key.startsWith("sk_test_") ||
       (key.startsWith("sk_live_") && process.env.ENABLE_LIVE_STRIPE==="true"))) {
    throw new Error("Live boosts require a separate enabled live-payment switch.");
  }
  if (!/^price_[A-Za-z0-9]+$/.test(price)) throw new Error("Boost price is not configured");
  const u=new URL(origin);
  if (u.protocol!=="https:" || u.pathname!=="/" || u.search || u.hash) {
    throw new Error("Boost return origin must be a canonical HTTPS URL");
  }
  return { key, secret, price, origin:u.origin };
}

/** Structured event only from HMAC-authenticated Stripe webhook. */
export function parsePaidBoostEvent(raw:unknown):PaidBoostEvent|null {
  if (!raw || typeof raw!=="object" || (raw as any).type!=="checkout.session.completed") return null;
  const e=boostEvent.safeParse(raw);
  if (!e.success) return null;
  const session=e.data.data.object;
  if (session.client_reference_id!==session.metadata.jaannee_boost_id) {
    throw new Error("Mismatched boost reference");
  }
  return {
    eventId:e.data.id,boostId:session.metadata.jaannee_boost_id,
    businessId:session.metadata.jaannee_business_id,
    sessionId:session.id,paymentIntentId:session.payment_intent,
    amountTotal:session.amount_total,currency:session.currency,
  };
}

async function stripeRequest<T>(
  method:"GET"|"POST",path:string,key:string,params?:Record<string,string>,
):Promise<T> {
  const response=await fetch("https://api.stripe.com/v1/"+path,{
    method,
    headers:{
      Authorization:"Bearer "+key,
      ...(params?{"Content-Type":"application/x-www-form-urlencoded"}:{}),
    },
    body:params?new URLSearchParams(params).toString():undefined,
    signal:AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("Stripe sponsorship service unavailable");
  return await response.json() as T;
}

export async function createSponsoredBoostCheckout(
  boostId:string,businessId:string,
):Promise<string> {
  const cfg=sponsoredBoostConfig();
  const session=await stripeRequest<{id:string;url:string}>("POST","checkout/sessions",cfg.key,{
    mode:"payment",
    "line_items[0][price]":cfg.price,
    "line_items[0][quantity]":"1",
    client_reference_id:boostId,
    "metadata[jaannee_boost_id]":boostId,
    "metadata[jaannee_business_id]":businessId,
    success_url:cfg.origin+"/business?boost=success",
    cancel_url:cfg.origin+"/business?boost=cancelled",
  });
  const url=new URL(session.url);
  if(url.protocol!=="https:" || url.hostname!=="checkout.stripe.com") {
    throw new Error("Unexpected Stripe checkout destination");
  }
  return url.toString();
}

/**
 * Stripe webhook signature alone is necessary but not sufficient: fetch line
 * items from Stripe and confirm that the paid Checkout used our exact Price.
 * No browser-supplied amount or metadata can unlock a sponsored placement.
 */
export async function verifyBoostCheckoutLineItem(event:PaidBoostEvent):Promise<void> {
  const cfg=sponsoredBoostConfig();
  const receipt=await stripeRequest<{
    id:string;payment_status:string;mode:string;amount_total:number;currency:string;
  }>("GET","checkout/sessions/"+event.sessionId,cfg.key);
  if(receipt.id!==event.sessionId || receipt.payment_status!=="paid" ||
     receipt.mode!=="payment" || receipt.currency!=="thb" ||
     receipt.amount_total!==event.amountTotal){
    throw new Error("Paid sponsorship checkout could not be verified");
  }
  const items=await stripeRequest<{data:Array<{
    price:{id:string;currency:string};quantity:number;amount_total:number;
  }>;has_more:boolean}>("GET","checkout/sessions/"+event.sessionId+"/line_items?limit=2",cfg.key);
  if(items.has_more || items.data.length!==1 ||
     items.data[0]?.price.id!==cfg.price ||
     items.data[0]?.price.currency!=="thb" ||
     items.data[0]?.quantity!==1 ||
     items.data[0]?.amount_total!==event.amountTotal){
    throw new Error("Sponsor payment did not use the approved Stripe price");
  }
}
