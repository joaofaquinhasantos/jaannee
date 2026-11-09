import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid=z.string().uuid();
async function adminDb() {
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function ownedVerifiedBusiness(context:any,businessId:string){
  const r=await (context.supabase as any).from("restaurant_businesses")
    .select("id,owner_id,name,review_status,verified_place_id,plan_tier,billing_status")
    .eq("id",businessId).eq("owner_id",context.userId).maybeSingle();
  if(r.error)throw new Error("Restaurant database currently unavailable.");
  if(!r.data)throw new Error("Restaurant ownership required.");
  if(r.data.review_status!=="verified" || !r.data.verified_place_id) {
    throw new Error("Restaurant verification is required before subscribing.");
  }
  return r.data as any;
}

export const getBusinessBillingState=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .inputValidator((input:{businessId:string})=>z.object({businessId:uuid}).parse(input))
  .handler(async({data,context})=>{
    const b=await ownedVerifiedBusiness(context,data.businessId);
    return {
      tier:b.plan_tier as "free"|"pro"|"growth",
      status:b.billing_status as string,
      configured:process.env.ENABLE_RESTAURANT_BILLING==="true" &&
        Boolean(process.env.STRIPE_SECRET_KEY) &&
        Boolean(process.env.STRIPE_WEBHOOK_SECRET) &&
        Boolean(process.env.STRIPE_PRO_PRICE_ID) &&
        Boolean(process.env.STRIPE_GROWTH_PRICE_ID) &&
        Boolean(process.env.STRIPE_CHECKOUT_RETURN_ORIGIN),
    };
  });

export const beginBusinessSubscription=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((input:{businessId:string;tier:"pro"|"growth"})=>z.object({
    businessId:uuid,tier:z.enum(["pro","growth"]),
  }).parse(input))
  .handler(async({data,context})=>{
    // Validate availability before creating ANY external Stripe objects.
    const {stripeBillingConfig,createStripeCustomer,createStripeSubscriptionCheckout}
      =await import("@/lib/stripe-billing.server");
    stripeBillingConfig();
    const business=await ownedVerifiedBusiness(context,data.businessId);
    if(["active","trialing"].includes(business.billing_status)) {
      throw new Error("Manage your current subscription in the billing portal.");
    }

    const db=await adminDb();
    let account=await db.from("restaurant_billing_accounts")
      .select("stripe_customer_id,stripe_subscription_id")
      .eq("business_id",business.id).maybeSingle();
    if(account.error)throw new Error("Unable to access restaurant billing.");
    if(!account.data) {
      const customerId=await createStripeCustomer(business.id,business.name);
      const inserted=await db.from("restaurant_billing_accounts").insert({
        business_id:business.id,stripe_customer_id:customerId,
      }).select("stripe_customer_id,stripe_subscription_id").maybeSingle();
      if(inserted.error && inserted.error.code!=="23505") {
        throw new Error("Unable to initialize restaurant billing.");
      }
      account=inserted.data?inserted:await db.from("restaurant_billing_accounts")
        .select("stripe_customer_id,stripe_subscription_id")
        .eq("business_id",business.id).maybeSingle();
    }
    if(!account.data?.stripe_customer_id)throw new Error("Billing customer unavailable.");
    const url=await createStripeSubscriptionCheckout(
      business.id,account.data.stripe_customer_id,data.tier,
    );
    return {url};
  });

export const openBusinessBillingPortal=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((input:{businessId:string})=>z.object({businessId:uuid}).parse(input))
  .handler(async({data,context})=>{
    const {stripeBillingConfig,createStripeBillingPortal}=await import("@/lib/stripe-billing.server");
    stripeBillingConfig();
    const business=await ownedVerifiedBusiness(context,data.businessId);
    const db=await adminDb();
    const account=await db.from("restaurant_billing_accounts")
      .select("stripe_customer_id")
      .eq("business_id",business.id).maybeSingle();
    if(account.error || !account.data?.stripe_customer_id)throw new Error("No billing account found.");
    const url=await createStripeBillingPortal(account.data.stripe_customer_id);
    return {url};
  });
