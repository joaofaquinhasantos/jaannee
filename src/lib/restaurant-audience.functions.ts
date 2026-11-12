import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Privacy boundary: restaurant owners receive aggregate counts only.
 * Individual follower identities or marketing permissions are never returned.
 */
export const getRestaurantAudienceSummary=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .inputValidator((input:{businessId:string})=>z.object({
    businessId:z.string().uuid(),
  }).parse(input))
  .handler(async({data,context})=>{
    const owner=await (context.supabase as any).from("restaurant_businesses")
      .select("id,owner_id,review_status,name")
      .eq("id",data.businessId).eq("owner_id",context.userId).maybeSingle();
    if(owner.error)throw new Error("Restaurant verification is temporarily unavailable.");
    if(!owner.data || owner.data.review_status!=="verified"){
      throw new Error("Verified restaurant ownership is required for audience statistics.");
    }
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const db=supabaseAdmin as any;
    // Use no record retrieval; counts cannot reveal follower identities.
    const [followers,vouchersAllowed,messagesAllowed,campaigns,loyalty]=await Promise.all([
      db.from("restaurant_followers").select("user_id",{count:"exact",head:true})
        .eq("business_id",data.businessId),
      db.from("restaurant_followers").select("user_id",{count:"exact",head:true})
        .eq("business_id",data.businessId).eq("allow_vouchers",true),
      db.from("restaurant_followers").select("user_id",{count:"exact",head:true})
        .eq("business_id",data.businessId).eq("allow_messages",true),
      db.from("restaurant_growth_campaigns").select("id,status")
        .eq("business_id",data.businessId).limit(50),
      db.from("restaurant_loyalty_programs").select("id,active")
        .eq("business_id",data.businessId).maybeSingle(),
    ]);
    if([followers,vouchersAllowed,messagesAllowed,campaigns,loyalty].some(r=>r.error)){
      throw new Error("Audience statistics are currently unavailable.");
    }
    const activeCampaigns=(campaigns.data??[]).filter((c:any)=>c.status==="active").length;
    let loyaltyMembers=0;
    if(loyalty.data?.id){
      const members=await db.from("restaurant_loyalty_cards")
        .select("user_id",{count:"exact",head:true})
        .eq("program_id",loyalty.data.id);
      if(members.error)throw new Error("Loyalty statistics are currently unavailable.");
      loyaltyMembers=members.count??0;
    }
    return {
      followers:followers.count??0,
      voucherOptIns:vouchersAllowed.count??0,
      announcementOptIns:messagesAllowed.count??0,
      activeCampaigns,
      loyaltyMembers,
    };
  });
