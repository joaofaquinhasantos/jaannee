import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid=z.string().uuid();
const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).nullable().optional();
const draftSchema=z.object({
  businessId:uuid,
  headline:z.string().trim().min(5).max(90),
  body:z.string().trim().min(5).max(260),
  areaSlug:slug,
  categorySlug:slug,
  promotionCampaignId:uuid.nullable().optional(),
});
async function db(){
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
function assertDB(response:any,defaultMessage="Sponsored placement temporarily unavailable"){
  if(response.error)throw new Error(response.error.message||defaultMessage);
  return response.data;
}
async function verifiedOwner(context:any,id:string){
  const r=await (context.supabase as any).from("restaurant_businesses")
    .select("id,owner_id,slug,review_status,published_at,verified_place_id")
    .eq("id",id).eq("owner_id",context.userId).maybeSingle();
  assertDB(r);
  if(!r.data || r.data.review_status!=="verified" ||
     !r.data.verified_place_id || !r.data.published_at){
    throw new Error("A verified and published restaurant is required for sponsorships.");
  }
  return r.data as {id:string;slug:string;verified_place_id:string};
}
async function adminOnly(context:any){
  const service=await db();
  const auth=await service.from("user_roles").select("user_id")
    .eq("user_id",context.userId).eq("role","admin").maybeSingle();
  assertDB(auth);
  if(!auth.data)throw new Error("Administrator authorization required");
  return service;
}

export const createSponsoredDraft=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>draftSchema.parse(v))
  .handler(async({data,context})=>{
    await verifiedOwner(context,data.businessId);
    const service=await db();
    if(data.areaSlug){
      const a=await service.from("areas").select("slug").eq("slug",data.areaSlug).maybeSingle();
      assertDB(a);
      if(!a.data)throw new Error("Select an existing Bangkok neighborhood.");
    }
    if(data.categorySlug){
      const c=await service.from("categories").select("slug").eq("slug",data.categorySlug).maybeSingle();
      assertDB(c);
      if(!c.data)throw new Error("Select an existing dish category.");
    }
    if(data.promotionCampaignId){
      const promo=await service.from("restaurant_growth_campaigns")
        .select("id").eq("id",data.promotionCampaignId)
        .eq("business_id",data.businessId).eq("kind","promotion")
        .eq("status","active").maybeSingle();
      assertDB(promo);
      if(!promo.data)throw new Error("Only your active public promotion can be boosted.");
    }
    const count=await service.from("restaurant_sponsored_boosts")
      .select("id",{count:"exact",head:true}).eq("business_id",data.businessId);
    assertDB(count);
    if((count.count??0)>=30)throw new Error("Sponsored draft limit reached.");
    const r=await service.from("restaurant_sponsored_boosts").insert({
      business_id:data.businessId,created_by:context.userId,
      headline:data.headline,body:data.body,
      target_area_slug:data.areaSlug??null,
      target_category_slug:data.categorySlug??null,
      source_campaign_id:data.promotionCampaignId??null,
    }).select("id,review_status").single();
    assertDB(r);
    return r.data as {id:string;review_status:"draft"};
  });

export const listMySponsoredBoosts=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:{businessId:string})=>z.object({businessId:uuid}).parse(v))
  .handler(async({data,context})=>{
    await verifiedOwner(context,data.businessId);
    const q=await (context.supabase as any).from("restaurant_sponsored_boosts")
      .select("id,headline,body,target_area_slug,target_category_slug,review_status,review_note,payment_status,starts_at,ends_at,created_at")
      .eq("business_id",data.businessId)
      .order("created_at",{ascending:false}).limit(50);
    assertDB(q);
    return q.data??[];
  });

export const submitSponsoredDraft=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({businessId:uuid,boostId:uuid}).parse(v))
  .handler(async({data,context})=>{
    await verifiedOwner(context,data.businessId);
    const service=await db();
    const q=await service.from("restaurant_sponsored_boosts")
      .update({review_status:"submitted",updated_at:new Date().toISOString()})
      .eq("id",data.boostId).eq("business_id",data.businessId)
      .eq("review_status","draft").eq("payment_status","unpaid")
      .select("id").maybeSingle();
    assertDB(q);
    if(!q.data)throw new Error("Only your unpaid draft can be submitted for review.");
    return {ok:true};
  });

export const listSponsoredReviews=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=>{
    const service=await adminOnly(context);
    const q=await service.from("restaurant_sponsored_boosts")
      .select("id,business_id,headline,body,target_area_slug,target_category_slug,created_at,restaurant:restaurant_businesses(name,slug)")
      .eq("review_status","submitted").order("created_at",{ascending:true}).limit(40);
    assertDB(q);
    return q.data??[];
  });

export const reviewSponsoredBoost=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({
    boostId:uuid,approved:z.boolean(),note:z.string().trim().min(10).max(1000),
  }).parse(v))
  .handler(async({data,context})=>{
    const service=await adminOnly(context);
    const q=await service.rpc("review_restaurant_sponsored_boost",{
      _boost_id:data.boostId,_reviewer_id:context.userId,
      _approve:data.approved,_note:data.note,
    });
    assertDB(q);
    return {approved:q.data===true};
  });

export const purchaseSponsoredBoost=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({businessId:uuid,boostId:uuid}).parse(v))
  .handler(async({data,context})=>{
    const {sponsoredBoostConfig,createSponsoredBoostCheckout}=await import("@/lib/sponsored-billing.server");
    sponsoredBoostConfig();
    await verifiedOwner(context,data.businessId);
    const service=await db();
    const record=await service.from("restaurant_sponsored_boosts")
      .select("id,review_status,payment_status").eq("id",data.boostId)
      .eq("business_id",data.businessId).maybeSingle();
    assertDB(record);
    if(!record.data || record.data.review_status!=="approved" ||
       record.data.payment_status!=="unpaid"){
      throw new Error("Only reviewed, unpaid sponsored drafts can be purchased.");
    }
    const url=await createSponsoredBoostCheckout(data.boostId,data.businessId);
    return {url};
  });

/** Whitelisted public projection: only paid, reviewed, active placements. */
export const listSponsoredDiscovery=createServerFn({method:"GET"})
  .inputValidator((v:{categorySlug?:string;areaSlug?:string})=>
    z.object({
      categorySlug:z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
      areaSlug:z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
    }).parse(v??{}))
  .handler(async({data})=>{
    // Emergency off-switch: no sponsored content is exposed until reviewed
    // pricing, refund handling and platform monitoring have been approved.
    if(process.env.ENABLE_SPONSORED_BOOSTS!=="true")return null;
    const service=await db();
    const now=new Date().toISOString();
    const q=await service.from("restaurant_sponsored_boosts")
      .select("id,business_id,headline,body,target_area_slug,target_category_slug,starts_at,ends_at,restaurant:restaurant_businesses!inner(name,slug,review_status,published_at)")
      .eq("review_status","approved").eq("payment_status","paid")
      .lte("starts_at",now).gt("ends_at",now)
      .eq("restaurant.review_status","verified")
      .not("restaurant.published_at","is",null)
      .limit(30);
    assertDB(q);
    const eligible=(q.data??[]).filter((ad:any)=>
      (!ad.target_area_slug || ad.target_area_slug===data.areaSlug) &&
      (!ad.target_category_slug || ad.target_category_slug===data.categorySlug)
    );
    if(!eligible.length)return null;
    // A simple deterministic daily rotation, not a bidding algorithm or dish rank.
    eligible.sort((a:any,b:any)=>a.id.localeCompare(b.id));
    const today=Math.floor(Date.now()/86400_000);
    const ad=eligible[today%eligible.length];
    const venue=Array.isArray(ad.restaurant)?ad.restaurant[0]:ad.restaurant;
    return {
      id:ad.id,headline:ad.headline,body:ad.body,
      restaurantName:venue?.name??"Restaurant",
      restaurantSlug:venue?.slug as string,
      disclosure:"Sponsored" as const,
      endsAt:ad.ends_at as string,
    };
  });
