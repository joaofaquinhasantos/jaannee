import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { effectiveBusinessPlan, hasBusinessFeature } from "@/lib/business-entitlements";

const uuid = z.string().uuid();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const businessFields = z.object({
  name: z.string().trim().min(3).max(80),
  area: z.string().trim().min(2).max(100),
  cuisine: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).default(""),
});
const translated = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
});
const menuFields = z.object({
  restaurantId: uuid,
  itemId: uuid.optional(),
  category: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(120),
  nameTh: z.string().trim().max(120).optional(),
  descriptionEn: z.string().trim().max(500).default(""),
  descriptionTh: z.string().trim().max(500).default(""),
  priceThb: z.number().finite().min(0).max(100000),
  available: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  approvedTranslations: z.object({
    zh: translated.optional(),
    ja: translated.optional(),
    fr: translated.optional(),
  }).default({}),
});

async function adminDb() {
  // The secret key is only referenced during server handlers, never in a bundle.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function fail(error: any, fallback = "Restaurant database operation failed") {
  if (error) throw new Error(error.message || fallback);
}

async function requireOwner(context: any, businessId: string) {
  const query = await context.supabase
    .from("restaurant_businesses")
    .select("id, owner_id, slug, name, area_label, cuisine, description, review_status, published_at, verified_place_id, plan_tier, billing_status, trial_ends_at")
    .eq("id", businessId)
    .eq("owner_id", context.userId)
    .maybeSingle();
  fail(query.error);
  if (!query.data) throw new Error("Restaurant access denied");
  return query.data as any;
}

async function requireAdmin(context: any) {
  const db = await adminDb();
  const query = await db
    .from("user_roles")
    .select("user_id")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  fail(query.error);
  if (!query.data) throw new Error("Administrator access required");
  return db;
}

function makeSlug(name: string): string {
  const safe = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 65).replace(/-+$/g, "") || "restaurant";
  return safe + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export const listMyBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await (context.supabase as any)
      .from("restaurant_businesses")
      .select("id, slug, name, area_label, cuisine, description, review_status, review_note, published_at, verified_place_id, plan_tier, billing_status, trial_ends_at, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    fail(result.error);
    return result.data ?? [];
  });

export const createBusinessDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; area: string; cuisine: string; description?: string }) =>
    businessFields.parse(input),
  )
  .handler(async ({ data, context }) => {
    const existing = await (context.supabase as any)
      .from("restaurant_businesses").select("id", { count: "exact", head: true })
      .eq("owner_id", context.userId);
    fail(existing.error);
    if ((existing.count ?? 0) >= 3) throw new Error("Limit reached: contact support to manage more than three restaurants.");
    const db = await adminDb();
    const result = await db.from("restaurant_businesses").insert({
      owner_id: context.userId,
      slug: makeSlug(data.name),
      name: data.name, area_label: data.area, cuisine: data.cuisine,
      description: data.description, review_status: "draft",
      plan_tier: "free", billing_status: "free",
    }).select("id, slug").single();
    fail(result.error);
    return result.data as { id: string; slug: string };
  });

export const updateBusinessDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    businessId: string; name: string; area: string; cuisine: string; description?: string;
  }) => businessFields.extend({ businessId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const business = await requireOwner(context, data.businessId);
    if (!["draft","rejected"].includes(business.review_status)) {
      throw new Error("Submitted or verified business details require a reviewed change request.");
    }
    const db = await adminDb();
    const result = await db.from("restaurant_businesses").update({
      name: data.name, area_label: data.area, cuisine: data.cuisine,
      description: data.description, updated_at: new Date().toISOString(),
    }).eq("id", data.businessId).eq("owner_id", context.userId);
    fail(result.error);
    return { ok: true };
  });

export const submitBusinessForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string; verificationNote: string }) => z.object({
    businessId: uuid, verificationNote: z.string().trim().min(10).max(1000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const business = await requireOwner(context, data.businessId);
    if (!["draft","rejected"].includes(business.review_status)) {
      throw new Error("This business is already submitted or verified.");
    }
    const db = await adminDb();
    const result = await db.from("restaurant_businesses")
      .update({
        verification_note: data.verificationNote,
        review_status: "submitted",
        review_note: null,
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.businessId).eq("owner_id", context.userId);
    fail(result.error);
    return { ok: true };
  });

export const listMyBusinessMenu = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string }) => z.object({ businessId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await requireOwner(context, data.businessId);
    const result = await (context.supabase as any)
      .from("restaurant_menu_entries")
      .select("id, restaurant_id, category, name_en, name_th, description_en, description_th, approved_translations, price_thb, available, sort_order")
      .eq("restaurant_id", data.businessId)
      .order("sort_order", { ascending: true })
      .limit(500);
    fail(result.error);
    return result.data ?? [];
  });

export const upsertBusinessMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => menuFields.parse(input))
  .handler(async ({ data, context }) => {
    const business = await requireOwner(context, data.restaurantId);
    if (business.review_status === "rejected") {
      throw new Error("Please correct your restaurant verification details before changing the menu.");
    }
    const plan = effectiveBusinessPlan(business);
    if (Object.keys(data.approvedTranslations).length &&
        !hasBusinessFeature(business, "ai_translation")) {
      throw new Error("Additional published languages require an active paid plan.");
    }
    const db = await adminDb();
    if (!data.itemId) {
      const countResult = await db.from("restaurant_menu_entries")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", business.id);
      fail(countResult.error);
      if ((countResult.count ?? 0) >= (plan === "free" ? 150 : 500)) {
        throw new Error("Menu limit reached for your current plan.");
      }
    }
    const payload = {
      category: data.category, name_en: data.nameEn, name_th: data.nameTh || null,
      description_en: data.descriptionEn, description_th: data.descriptionTh,
      approved_translations: data.approvedTranslations,
      price_thb: data.priceThb, available: data.available, sort_order: data.sortOrder,
      updated_at: new Date().toISOString(),
    };
    if (data.itemId) {
      const update = await db.from("restaurant_menu_entries").update(payload)
        .eq("id", data.itemId).eq("restaurant_id", business.id)
        .select("id").maybeSingle();
      fail(update.error);
      if (!update.data) throw new Error("Menu entry not found");
      return { id: update.data.id as string };
    }
    const insert = await db.from("restaurant_menu_entries")
      .insert({ ...payload, restaurant_id: business.id })
      .select("id").single();
    fail(insert.error);
    return { id: insert.data.id as string };
  });

export const deleteBusinessMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string; itemId: string }) => z.object({
    businessId: uuid, itemId: uuid,
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireOwner(context, data.businessId);
    const db = await adminDb();
    const result = await db.from("restaurant_menu_entries").delete()
      .eq("restaurant_id", data.businessId).eq("id", data.itemId)
      .select("id").maybeSingle();
    fail(result.error);
    if (!result.data) throw new Error("Menu entry not found");
    return { ok: true };
  });

export const setBusinessMenuPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string; publish: boolean }) => z.object({
    businessId: uuid, publish: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const business = await requireOwner(context, data.businessId);
    if (business.review_status !== "verified" || !business.verified_place_id) {
      throw new Error("Restaurant ownership must be verified before publishing.");
    }
    const db = await adminDb();
    if (data.publish) {
      const items = await db.from("restaurant_menu_entries")
        .select("id").eq("restaurant_id", business.id).eq("available", true).limit(1);
      fail(items.error);
      if (!items.data?.length) throw new Error("Add an available dish before publishing the menu.");
    }
    const result = await db.from("restaurant_businesses").update({
      published_at: data.publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", business.id).eq("owner_id", context.userId);
    fail(result.error);
    return { published: data.publish, slug: business.slug };
  });

export const listPendingBusinessReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context);
    const result = await db.from("restaurant_businesses")
      .select("id, slug, name, owner_id, area_label, cuisine, verification_note, created_at")
      .eq("review_status", "submitted")
      .order("created_at", { ascending: true }).limit(50);
    fail(result.error);
    return result.data ?? [];
  });

export const reviewBusinessSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string; approved: boolean; note?: string }) =>
    z.object({
      businessId: uuid, approved: z.boolean(),
      note: z.string().trim().max(1000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const result = await db.rpc("admin_review_business_draft", {
      _business_id: data.businessId,
      _reviewer_id: context.userId,
      _approve: data.approved,
      _note: data.note ?? "",
    });
    fail(result.error);
    return { ok: true, verifiedPlaceId: (result.data ?? null) as string | null };
  });

/** Public SSR projection. No owner id, proof notes, subscription data or drafts. */
export const getPublicBusinessMenu = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug }).parse(input))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const business = await db.from("restaurant_businesses")
      .select("id, name, slug, area_label, cuisine, description, plan_tier, billing_status, trial_ends_at")
      .eq("slug", data.slug)
      .eq("review_status", "verified")
      .not("published_at", "is", null)
      .maybeSingle();
    fail(business.error);
    if (!business.data) return null;
    const rows = await db.from("restaurant_menu_entries")
      .select("id, category, name_en, name_th, description_en, description_th, approved_translations, price_thb, sort_order")
      .eq("restaurant_id", business.data.id)
      .eq("available", true)
      .order("sort_order", { ascending: true })
      .limit(500);
    fail(rows.error);
    const paid = hasBusinessFeature(business.data, "ai_translation");
    return {
      slug: business.data.slug as string,
      name: business.data.name as string,
      area: business.data.area_label as string,
      cuisine: business.data.cuisine as string,
      description: business.data.description as string,
      dishes: (rows.data ?? []).map((item: any) => ({
        id: item.id,
        category: item.category,
        name_en: item.name_en,
        name_th: item.name_th,
        description_en: item.description_en,
        description_th: item.description_th,
        approved_translations: paid ? item.approved_translations : {},
        price_thb: item.price_thb,
      })),
    };
  });
