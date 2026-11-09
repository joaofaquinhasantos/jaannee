import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasBusinessFeature } from "@/lib/business-entitlements";

const uuid=z.string().uuid();
async function db(){
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
function check(r:any){if(r.error)throw new Error(r.error.message||"Loyalty data unavailable");return r.data;}
async function programIfPublic(businessId:string){
  const service=await db();
  const b=await service.from("restaurant_businesses")
    .select("id,name,slug,review_status,published_at,plan_tier,billing_status,trial_ends_at")
    .eq("id",businessId).eq("review_status","verified")
    .not("published_at","is",null).maybeSingle();
  check(b);
  if(!b.data || !hasBusinessFeature(b.data,"loyalty"))return null;
  const p=await service.from("restaurant_loyalty_programs")
    .select("id,business_id,title,reward_description,visits_required,active")
    .eq("business_id",businessId).eq("active",true).maybeSingle();
  check(p);
  return p.data?{...p.data,restaurant:b.data.name}:null;
}
async function requireGrowthOwner(ctx:any,businessId:string){
  const q=await (ctx.supabase as any).from("restaurant_businesses")
    .select("id,owner_id,review_status,published_at,plan_tier,billing_status,trial_ends_at")
    .eq("id",businessId).eq("owner_id",ctx.userId).maybeSingle();
  check(q);
  if(!q.data || q.data.review_status!=="verified" || !q.data.published_at ||
     !hasBusinessFeature(q.data,"loyalty")){
    throw new Error("Verified Growth restaurant ownership required.");
  }
  return q.data;
}

export const configureRestaurantLoyalty=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({
    businessId:uuid,
    title:z.string().trim().min(3).max(80),
    rewardDescription:z.string().trim().min(3).max(200),
    visitsRequired:z.number().int().min(3).max(12),
    active:z.boolean(),
  }).parse(v))
  .handler(async({data,context})=>{
    await requireGrowthOwner(context,data.businessId);
    const service=await db();
    const existing=await service.from("restaurant_loyalty_programs")
      .select("id,visits_required").eq("business_id",data.businessId).maybeSingle();
    check(existing);
    if(existing.data && existing.data.visits_required!==data.visitsRequired){
      const c=await service.from("restaurant_loyalty_cards")
        .select("user_id",{count:"exact",head:true}).eq("program_id",existing.data.id);
      check(c);
      if((c.count??0)>0)throw new Error("Visit threshold cannot change after diners join.");
    }
    const updates={
      title:data.title,reward_description:data.rewardDescription,
      visits_required:data.visitsRequired,active:data.active,
      updated_at:new Date().toISOString(),
    };
    const r=existing.data
      ? await service.from("restaurant_loyalty_programs").update(updates)
          .eq("id",existing.data.id).eq("business_id",data.businessId)
          .select("id,active").single()
      : await service.from("restaurant_loyalty_programs").insert({
          ...updates,business_id:data.businessId,
        }).select("id,active").single();
    check(r);
    return r.data;
  });

export const getPublicRestaurantLoyalty=createServerFn({method:"GET"})
  .inputValidator((v:{businessId:string})=>z.object({businessId:uuid}).parse(v))
  .handler(async({data})=>programIfPublic(data.businessId));

export const joinRestaurantLoyalty=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:{businessId:string})=>z.object({businessId:uuid}).parse(v))
  .handler(async({data,context})=>{
    const p=await programIfPublic(data.businessId);
    if(!p)throw new Error("Loyalty program not available.");
    const service=await db();
    const r=await service.from("restaurant_loyalty_cards")
      .upsert({program_id:p.id,user_id:context.userId},{onConflict:"program_id,user_id",ignoreDuplicates:true})
      .select("program_id,user_id");
    check(r);
    return {ok:true,programId:p.id};
  });

export const getMyRestaurantLoyaltyCard=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:{businessId:string})=>z.object({businessId:uuid}).parse(v))
  .handler(async({data,context})=>{
    const p=await programIfPublic(data.businessId);
    if(!p)return null;
    const r=await (context.supabase as any).from("restaurant_loyalty_cards")
      .select("visits,reward_ready,redeemed_count,last_visit_at")
      .eq("program_id",p.id).eq("user_id",context.userId).maybeSingle();
    check(r);
    return {...p,card:r.data??null};
  });

export const getMyLoyaltyCheckinCode=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:{businessId:string})=>z.object({businessId:uuid}).parse(v))
  .handler(async({data,context})=>{
    const p=await programIfPublic(data.businessId);
    if(!p)throw new Error("Loyalty program not available.");
    const card=await (context.supabase as any).from("restaurant_loyalty_cards")
      .select("user_id,reward_ready").eq("program_id",p.id)
      .eq("user_id",context.userId).maybeSingle();
    check(card);
    if(!card.data)throw new Error("Join this program first.");
    const {signLoyaltyToken,loyaltySecret}=await import("@/lib/loyalty-tokens.server");
    const action=card.data.reward_ready?"redeem":"visit";
    return {
      token:signLoyaltyToken({
        businessId:data.businessId,programId:p.id,userId:context.userId,action,
      },loyaltySecret()),
      action,
      expiresInSeconds:300,
    };
  });

export const confirmRestaurantLoyaltyCode=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({
    businessId:uuid,token:z.string().min(30).max(800),
  }).parse(v))
  .handler(async({data,context})=>{
    await requireGrowthOwner(context,data.businessId);
    const {loyaltySecret,verifyLoyaltyToken}=await import("@/lib/loyalty-tokens.server");
    const proof=verifyLoyaltyToken(data.token,loyaltySecret());
    if(proof.businessId!==data.businessId)throw new Error("Guest code belongs to another restaurant.");
    const service=await db();
    const p=await service.from("restaurant_loyalty_programs")
      .select("id").eq("id",proof.programId).eq("business_id",data.businessId)
      .eq("active",true).maybeSingle();
    check(p);
    if(!p.data)throw new Error("Loyalty program not found.");
    const result=await service.rpc("apply_restaurant_loyalty_action",{
      _program_id:proof.programId,_user_id:proof.userId,
      _actor_id:context.userId,_kind:proof.action,
    });
    check(result);
    return result.data as {visits:number;reward_ready:boolean};
  });
