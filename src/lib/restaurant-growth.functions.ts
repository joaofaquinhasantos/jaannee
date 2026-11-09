import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasBusinessFeature } from "@/lib/business-entitlements";

const uuid=z.string().uuid();
async function adminDb(){
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
function fail(result:any){
  if(result.error)throw new Error(result.error.message||"Growth database temporarily unavailable");
  return result.data;
}
function liveGrowth(b:any){
  return b?.review_status==="verified" && Boolean(b.published_at) &&
    hasBusinessFeature(b,"loyalty");
}
async function requireOwner(ctx:any,businessId:string,needsGrowth=true){
  const r=await (ctx.supabase as any).from("restaurant_businesses")
    .select("id,owner_id,slug,name,review_status,published_at,verified_place_id,plan_tier,billing_status,trial_ends_at")
    .eq("id",businessId).eq("owner_id",ctx.userId).maybeSingle();
  fail(r);
  if(!r.data)throw new Error("Restaurant ownership required.");
  if(needsGrowth && !liveGrowth(r.data))throw new Error("Verified published Growth restaurant required.");
  return r.data as any;
}
async function publicBusiness(businessId:string){
  const db=await adminDb();
  const r=await db.from("restaurant_businesses")
    .select("id,name,slug,review_status,published_at,plan_tier,billing_status,trial_ends_at")
    .eq("id",businessId).eq("review_status","verified")
    .not("published_at","is",null).maybeSingle();
  fail(r);
  return r.data??null;
}

export const followRestaurantBusiness=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({
    businessId:uuid,
    follow:z.boolean(),
    allowVouchers:z.boolean().default(false),
    allowMessages:z.boolean().default(false),
  }).parse(v))
  .handler(async({data,context})=>{
    const b=await publicBusiness(data.businessId);
    if(!b)throw new Error("Restaurant not available.");
    const db=await adminDb();
    if(data.follow){
      const r=await db.from("restaurant_followers").upsert({
        business_id:data.businessId,user_id:context.userId,
        allow_vouchers:data.allowVouchers,allow_messages:data.allowMessages,
        updated_at:new Date().toISOString(),
      },{onConflict:"business_id,user_id"});
      fail(r);
    }else{
      const r=await db.from("restaurant_followers").delete()
        .eq("business_id",data.businessId).eq("user_id",context.userId);
      fail(r);
    }
    return {following:data.follow,allowVouchers:data.follow&&data.allowVouchers,allowMessages:data.follow&&data.allowMessages};
  });

export const getMyRestaurantFollow=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:{businessId:string})=>z.object({businessId:uuid}).parse(v))
  .handler(async({data,context})=>{
    const r=await (context.supabase as any).from("restaurant_followers")
      .select("business_id,allow_vouchers,allow_messages")
      .eq("business_id",data.businessId).eq("user_id",context.userId).maybeSingle();
    fail(r);
    return r.data??null;
  });

const campaignInput=z.object({
  businessId:uuid,kind:z.enum(["promotion","voucher"]),
  title:z.string().trim().min(3).max(80),
  message:z.string().trim().min(3).max(320),
  discountPercent:z.number().int().min(1).max(90).nullable(),
  startsAt:z.string().datetime(),endsAt:z.string().datetime(),
});
export const createRestaurantCampaign=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>campaignInput.parse(v))
  .handler(async({data,context})=>{
    await requireOwner(context,data.businessId);
    const start=Date.parse(data.startsAt),end=Date.parse(data.endsAt);
    if(!Number.isFinite(start)||!Number.isFinite(end)||
       start<Date.now()-60_000||end<=start||end>start+90*86400_000){
      throw new Error("Use a future campaign lasting no more than 90 days.");
    }
    if(data.kind==="voucher"&&data.discountPercent===null){
      throw new Error("Voucher discount is required.");
    }
    const db=await adminDb();
    const count=await db.from("restaurant_growth_campaigns")
      .select("id",{count:"exact",head:true}).eq("business_id",data.businessId);
    fail(count);
    if((count.count??0)>=50)throw new Error("Campaign limit reached.");
    const r=await db.from("restaurant_growth_campaigns").insert({
      business_id:data.businessId,created_by:context.userId,
      kind:data.kind,title:data.title,message:data.message,
      discount_percent:data.discountPercent,starts_at:data.startsAt,ends_at:data.endsAt,
    }).select("id,status").single();
    fail(r);
    return r.data as {id:string;status:"draft"};
  });

export const getMyRestaurantCampaigns=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:{businessId:string})=>z.object({businessId:uuid}).parse(v))
  .handler(async({data,context})=>{
    await requireOwner(context,data.businessId,false);
    const r=await (context.supabase as any).from("restaurant_growth_campaigns")
      .select("id,kind,title,message,discount_percent,starts_at,ends_at,status,created_at")
      .eq("business_id",data.businessId).order("created_at",{ascending:false}).limit(50);
    fail(r);
    return r.data??[];
  });

export const publishRestaurantCampaign=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({businessId:uuid,campaignId:uuid,activate:z.boolean()}).parse(v))
  .handler(async({data,context})=>{
    await requireOwner(context,data.businessId);
    const db=await adminDb();
    const q=await db.from("restaurant_growth_campaigns")
      .select("id,starts_at,ends_at,status,kind").eq("id",data.campaignId)
      .eq("business_id",data.businessId).maybeSingle();
    fail(q);
    if(!q.data)throw new Error("Campaign not found.");
    if(data.activate){
      if(q.data.status!=="draft")throw new Error("Only draft campaigns may be activated.");
      if(Date.parse(q.data.ends_at)<=Date.now())throw new Error("Campaign has already expired.");
      const active=await db.from("restaurant_growth_campaigns").select("id",{count:"exact",head:true})
        .eq("business_id",data.businessId).eq("status","active")
        .gt("ends_at",new Date().toISOString());
      fail(active);
      if((active.count??0)>=3)throw new Error("Maximum three active campaigns per outlet.");
    }
    const r=await db.from("restaurant_growth_campaigns")
      .update({status:data.activate?"active":"archived",updated_at:new Date().toISOString()})
      .eq("id",data.campaignId).eq("business_id",data.businessId)
      .select("id,status").maybeSingle();
    fail(r);
    if(!r.data)throw new Error("Campaign not found");
    return {status:r.data.status};
  });

export const getPublicRestaurantPromotions=createServerFn({method:"GET"})
  .inputValidator((v:{businessId:string})=>z.object({businessId:uuid}).parse(v))
  .handler(async({data})=>{
    const b=await publicBusiness(data.businessId);
    if(!b||!liveGrowth(b))return [];
    const db=await adminDb();
    const now=new Date().toISOString();
    const r=await db.from("restaurant_growth_campaigns")
      .select("id,title,message,discount_percent,starts_at,ends_at")
      .eq("business_id",data.businessId).eq("kind","promotion").eq("status","active")
      .lte("starts_at",now).gt("ends_at",now).order("created_at",{ascending:false}).limit(5);
    fail(r);
    return (r.data??[]).map((c:any)=>({
      id:c.id,title:c.title,message:c.message,discountPercent:c.discount_percent,
      endsAt:c.ends_at,
    }));
  });

export const listMyFollowerOffers=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=>{
    const following=await (context.supabase as any).from("restaurant_followers")
      .select("business_id").eq("user_id",context.userId).eq("allow_vouchers",true).limit(100);
    fail(following);
    const ids=(following.data??[]).map((f:any)=>f.business_id);
    if(!ids.length)return [];
    const db=await adminDb();
    const b=await db.from("restaurant_businesses")
      .select("id,name,review_status,published_at,plan_tier,billing_status,trial_ends_at").in("id",ids);
    fail(b);
    const eligible=(b.data??[]).filter(liveGrowth);
    if(!eligible.length)return [];
    const now=new Date().toISOString();
    const offers=await db.from("restaurant_growth_campaigns")
      .select("id,business_id,title,message,discount_percent,starts_at,ends_at")
      .in("business_id",eligible.map((v:any)=>v.id)).eq("kind","voucher").eq("status","active")
      .lte("starts_at",now).gt("ends_at",now).order("created_at",{ascending:false}).limit(30);
    fail(offers);
    const names=new Map<string,string>(eligible.map((v:any)=>[v.id,v.name]));
    return (offers.data??[]).map((c:any)=>({
      id:c.id,businessId:c.business_id,restaurant:names.get(c.business_id),
      title:c.title,message:c.message,discountPercent:c.discount_percent,endsAt:c.ends_at,
    }));
  });

export const claimFollowerVoucher=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:{campaignId:string})=>z.object({campaignId:uuid}).parse(v))
  .handler(async({data,context})=>{
    const db=await adminDb();
    const q=await db.from("restaurant_growth_campaigns")
      .select("id,business_id,kind,status,starts_at,ends_at").eq("id",data.campaignId).maybeSingle();
    fail(q);
    const c=q.data,now=new Date();
    if(!c||c.kind!=="voucher"||c.status!=="active"||
       Date.parse(c.starts_at)>now.getTime()||Date.parse(c.ends_at)<=now.getTime()){
      throw new Error("Voucher offer is not available.");
    }
    const b=await publicBusiness(c.business_id);
    if(!b||!liveGrowth(b))throw new Error("Voucher offer is not available.");
    const follower=await (context.supabase as any).from("restaurant_followers")
      .select("business_id").eq("business_id",c.business_id)
      .eq("user_id",context.userId).eq("allow_vouchers",true).maybeSingle();
    fail(follower);
    if(!follower.data)throw new Error("Follow this restaurant and opt in to vouchers first.");
    const old=await (context.supabase as any).from("restaurant_voucher_claims")
      .select("id,claim_code,expires_at,redeemed_at")
      .eq("campaign_id",c.id).eq("user_id",context.userId).maybeSingle();
    fail(old);
    if(old.data)return old.data;
    const {randomBytes}=await import("node:crypto");
    const code="JNN-"+randomBytes(9).toString("base64url").toUpperCase();
    const insert=await db.from("restaurant_voucher_claims").insert({
      campaign_id:c.id,user_id:context.userId,claim_code:code,expires_at:c.ends_at,
    }).select("id,claim_code,expires_at,redeemed_at").single();
    if(insert.error?.code==="23505"){
      const race=await (context.supabase as any).from("restaurant_voucher_claims")
        .select("id,claim_code,expires_at,redeemed_at")
        .eq("campaign_id",c.id).eq("user_id",context.userId).single();
      fail(race);
      return race.data;
    }
    fail(insert);
    return insert.data;
  });

export const listMyVoucherClaims=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=>{
    const q=await (context.supabase as any).from("restaurant_voucher_claims")
      .select("id,campaign_id,claim_code,expires_at,redeemed_at,created_at")
      .eq("user_id",context.userId).order("created_at",{ascending:false}).limit(50);
    fail(q);
    const claims=q.data??[];
    if(!claims.length)return [];
    const db=await adminDb();
    const r=await db.from("restaurant_growth_campaigns")
      .select("id,business_id,title,discount_percent")
      .in("id",claims.map((c:any)=>c.campaign_id));
    fail(r);
    const byId=new Map<string,any>((r.data??[]).map((c:any)=>[c.id,c]));
    return claims.map((item:any)=>({
      ...item,title:byId.get(item.campaign_id)?.title??"Restaurant voucher",
      discountPercent:byId.get(item.campaign_id)?.discount_percent??null,
    }));
  });

export const redeemFollowerVoucher=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({
    businessId:uuid,code:z.string().trim().min(10).max(30),
  }).parse(v))
  .handler(async({data,context})=>{
    await requireOwner(context,data.businessId);
    const db=await adminDb();
    const claim=await db.from("restaurant_voucher_claims")
      .select("id,campaign_id,expires_at,redeemed_at").eq("claim_code",data.code).maybeSingle();
    fail(claim);
    if(!claim.data || claim.data.redeemed_at || Date.parse(claim.data.expires_at)<=Date.now()){
      throw new Error("Voucher code invalid, expired or already redeemed.");
    }
    const campaign=await db.from("restaurant_growth_campaigns")
      .select("id,business_id").eq("id",claim.data.campaign_id)
      .eq("business_id",data.businessId).maybeSingle();
    fail(campaign);
    if(!campaign.data)throw new Error("Voucher does not belong to this restaurant.");
    const updated=await db.from("restaurant_voucher_claims")
      .update({redeemed_at:new Date().toISOString(),redeemed_by:context.userId})
      .eq("id",claim.data.id).is("redeemed_at",null)
      .gt("expires_at",new Date().toISOString()).select("id").maybeSingle();
    fail(updated);
    if(!updated.data)throw new Error("This voucher was already redeemed.");
    return {ok:true};
  });
