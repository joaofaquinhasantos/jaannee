import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasBusinessFeature } from "@/lib/business-entitlements";

const uuid = z.string().uuid();
const textSource = z.object({
  type: z.literal("text"),
  text: z.string().trim().min(30).max(7000),
});
const imageSource = z.object({
  type: z.literal("image"),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(60).max(1_400_000),
});
const importSchema = z.object({
  businessId: uuid,
  source: z.discriminatedUnion("type", [textSource,imageSource]),
});
const translateSchema = z.object({
  businessId: uuid,
  targetLanguage: z.enum(["th","zh","fr","ja"]),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500),
  })).min(1).max(10),
});

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function requireAIEligibleBusiness(context: any, businessId: string) {
  const result = await (context.supabase as any).from("restaurant_businesses")
    .select("id,owner_id,review_status,plan_tier,billing_status,trial_ends_at")
    .eq("id",businessId)
    .eq("owner_id",context.userId)
    .maybeSingle();
  if (result.error) throw new Error("Restaurant records are currently unavailable.");
  if (!result.data) throw new Error("Restaurant ownership required.");
  if (result.data.review_status !== "verified") {
    throw new Error("Verify restaurant ownership before using AI-assisted menus.");
  }
  if (!hasBusinessFeature(result.data,"ai_translation")) {
    throw new Error("An active Pro or Growth subscription is required.");
  }
  if (process.env.ENABLE_RESTAURANT_AI !== "true" || !process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI menu processing has not been activated for this deployment.");
  }
  return result.data;
}

async function withQuota<T>(
  context: any, businessId: string, action: "import"|"translate",
  sourceType: "text"|"image", inputSize: number, work: () => Promise<T>,
): Promise<T> {
  const db = await adminDb();
  const reserved = await db.rpc("reserve_restaurant_ai_operation",{
    _business_id:businessId,
    _owner_id:context.userId,
    _action:action,
    _source_type:sourceType,
    _input_size:inputSize,
  });
  if (reserved.error || !reserved.data) {
    throw new Error(reserved.error?.message || "Unable to reserve an AI menu operation.");
  }
  let success = false;
  try {
    const result = await work();
    success = true;
    return result;
  } finally {
    const finished = await db.rpc("finish_restaurant_ai_operation",{
      _operation_id:reserved.data,
      _status:success ? "succeeded":"failed",
    });
    if (finished.error) {
      // Do not leak backend details. The reserved slot remains counted for cost safety.
      console.error("[JaanNee AI] Unable to finalize usage record.");
    }
  }
}

export const getRestaurantAiStatus = createServerFn({ method:"GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input:{businessId:string})=>z.object({businessId:uuid}).parse(input))
  .handler(async ({data,context})=>{
    const result=await (context.supabase as any).from("restaurant_businesses")
      .select("id,owner_id,review_status,plan_tier,billing_status,trial_ends_at")
      .eq("id",data.businessId).eq("owner_id",context.userId).maybeSingle();
    if(result.error)throw new Error("Restaurant database unavailable");
    if(!result.data)throw new Error("Restaurant ownership required");
    const paid=hasBusinessFeature(result.data,"ai_translation");
    const configured=process.env.ENABLE_RESTAURANT_AI==="true" && Boolean(process.env.AI_GATEWAY_API_KEY);
    const available=paid && configured && result.data.review_status==="verified";
    const monthStart=new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0,0,0,0);
    const usage=await (context.supabase as any).from("restaurant_ai_operations")
      .select("id",{count:"exact",head:true})
      .eq("business_id",data.businessId)
      .gte("created_at",monthStart.toISOString());
    if(usage.error)throw new Error("Unable to read AI usage");
    return {
      available,
      monthlyRemaining:Math.max(0,20-(usage.count??0)),
      planEligible:paid,
      ownerVerified:result.data.review_status==="verified",
      providerConfigured:configured,
      supportedSources:["text","image"] as const,
    };
  });

export const previewImportedBusinessMenu = createServerFn({ method:"POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input:unknown)=>importSchema.parse(input))
  .handler(async ({data,context})=>{
    await requireAIEligibleBusiness(context,data.businessId);
    const source=data.source;
    const inputSize=source.type==="text" ? source.text.length : Math.floor(source.base64.length*0.75);
    return withQuota(context,data.businessId,"import",source.type,inputSize,async()=>{
      const {extractMenuForReview}=await import("@/lib/ai-menu.server");
      const rows=await extractMenuForReview(source);
      return { items:rows, message:"Review all prices and descriptions before saving. Nothing has been published." };
    });
  });

export const previewBusinessTranslations = createServerFn({ method:"POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input:unknown)=>translateSchema.parse(input))
  .handler(async ({data,context})=>{
    await requireAIEligibleBusiness(context,data.businessId);
    const inputSize=JSON.stringify(data.items).length;
    return withQuota(context,data.businessId,"translate","text",inputSize,async()=>{
      const {translateMenuForReview}=await import("@/lib/ai-menu.server");
      const rows=await translateMenuForReview(data.targetLanguage,data.items);
      return {
        targetLanguage:data.targetLanguage,
        translations:rows,
        message:"AI-generated draft. Human approval is required before it can appear on the QR menu.",
      };
    });
  });
