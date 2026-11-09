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
        const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET;
        if(!webhookSecret ||
          (process.env.ENABLE_RESTAURANT_BILLING!=="true" &&
           process.env.ENABLE_SPONSORED_BOOSTS!=="true")){
          return new Response("Payment integrations unavailable",{status:503});
        }
        if(!verifyStripeSignature(
          raw,request.headers.get("stripe-signature"),webhookSecret,
        )){
          return new Response("Invalid signature",{status:400});
        }
        let event:unknown;
        try{event=JSON.parse(raw);}catch{return new Response("Invalid JSON",{status:400});}

        // One-time, prepaid and *admin-reviewed* Sponsored placements are
        // completely separate from restaurant subscriptions.
        if((event as any)?.type==="checkout.session.completed") {
          // Subscription Checkout sessions are not sponsored payments and must
          // not be retried just because the sponsorship module is disabled.
          const checkout=(event as any)?.data?.object;
          if(checkout?.mode!=="payment" || !checkout?.metadata?.jaannee_boost_id) {
            return new Response("Ignored non-sponsored checkout",{status:200});
          }
          if(process.env.ENABLE_SPONSORED_BOOSTS!=="true"){
            return new Response("Sponsored payments disabled",{status:503});
          }
          try{
            const {parsePaidBoostEvent,verifyBoostCheckoutLineItem}
              =await import("@/lib/sponsored-billing.server");
            const paid=parsePaidBoostEvent(event);
            if(!paid)return new Response("Ignored non-boost checkout",{status:200});
            await verifyBoostCheckoutLineItem(paid);
            const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
            const service=supabaseAdmin as any;
            const result=await service.rpc("activate_paid_restaurant_boost",{
              _boost_id:paid.boostId,_business_id:paid.businessId,
              _session_id:paid.sessionId,_event_id:paid.eventId,
              _payment_intent_id:paid.paymentIntentId,
              _amount_total:paid.amountTotal,_currency:paid.currency,
            });
            if(result.error)throw new Error("Sponsorship payment recording failed");
            return new Response("Sponsor payment recorded",{status:200});
          }catch{
            return new Response("Retry sponsored payment processing",{status:503});
          }
        }

        if(process.env.ENABLE_RESTAURANT_BILLING!=="true"){
          return new Response("Subscription billing disabled",{status:503});
        }
        let config:ReturnType<typeof stripeBillingConfig>;
        try{config=stripeBillingConfig();}
        catch{return new Response("Billing unavailable",{status:503});}
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
