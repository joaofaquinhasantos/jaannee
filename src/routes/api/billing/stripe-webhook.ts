import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhooks have no browser session. Authenticate the *raw bytes* with
 * Stripe's HMAC signature; never trust client-supplied subscription state.
 */
export const Route=createFileRoute("/api/billing/stripe-webhook")({
  server:{
    handlers:{
      POST:async({request})=>{
        if(!request.headers.get("content-type")?.includes("application/json")) {
          return new Response("Unsupported request",{status:415});
        }
        const len=Number(request.headers.get("content-length")||"0");
        if(len>2_000_000) return new Response("Payload too large",{status:413});
        let raw:string;
        try{raw=await request.text();}catch{return new Response("Invalid payload",{status:400});}
        if(raw.length>2_000_000)return new Response("Payload too large",{status:413});
        const {
          stripeBillingConfig,verifyStripeSignature,parseStripeSubscriptionEvent,
        }=await import("@/lib/stripe-billing.server");
        let config:ReturnType<typeof stripeBillingConfig>;
        try{config=stripeBillingConfig();}
        catch{return new Response("Billing unavailable",{status:503});}
        if(!verifyStripeSignature(
          raw,request.headers.get("stripe-signature"),config.webhookSecret,
        )){
          return new Response("Invalid signature",{status:400});
        }
        let event:unknown;
        try{event=JSON.parse(raw);}catch{return new Response("Invalid JSON",{status:400});}
        let parsed:ReturnType<typeof parseStripeSubscriptionEvent>;
        try{parsed=parseStripeSubscriptionEvent(event,{pro:config.pro,growth:config.growth});}
        catch{
          // Failing closed: unknown product prices must not grant plan access.
          return new Response("Unrecognized subscription",{status:422});
        }
        if(!parsed)return new Response("Ignored",{status:200});
        try{
          const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
          const db=supabaseAdmin as any;
          const result=await db.rpc("apply_restaurant_stripe_event",{
            _event_id:parsed.id,
            _event_created:parsed.created,
            _customer_id:parsed.customerId,
            _subscription_id:parsed.subscriptionId,
            _price_id:parsed.priceId,
            _plan:parsed.tier,
            _status:parsed.status,
            _trial_ends_at:parsed.trialEnd,
          });
          if(result.error)throw new Error("Could not persist verified subscription event");
          return new Response("Recorded",{status:200});
        }catch{
          // Stripe retries transient database failures; never reply 200 for a
          // verified, unprocessed event or the subscription could be lost.
          return new Response("Retry later",{status:503});
        }
      },
    },
  },
});
