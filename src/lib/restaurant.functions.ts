import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateVoucherNumber } from "@/lib/voucher";

const missingRestaurantSchema = (error: any) => error?.code === "42P01";
const optionalUrl = z.string().trim().url().max(500).or(z.literal(""));
const optionalPhotoUrl = z
  .string()
  .trim()
  .max(700)
  .refine((value) => !value || value.startsWith("/photos/") || /^https:\/\//i.test(value), {
    message: "Use an uploaded photo or a secure image URL.",
  });
const growthActive = (profile: any) =>
  profile?.subscription_tier === "growth" &&
  (profile?.subscription_status === "active" ||
    (profile?.subscription_status === "trialing" &&
      profile?.trial_ends_at &&
      new Date(profile.trial_ends_at).getTime() > Date.now()));

export const listClaimablePlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string }) =>
    z.object({ query: z.string().trim().max(100).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("places")
      .select("id, name, address, google_maps_url, area:areas(name_en, name_th)")
      .eq("status", "approved")
      .order("name")
      .limit(30);
    if (data.query) query = query.ilike("name", `%${data.query}%`);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return result.data ?? [];
  });

export const submitRestaurantClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { placeId: string; businessRole: string; verificationNote: string }) =>
    z
      .object({
        placeId: z.string().uuid(),
        businessRole: z.string().trim().min(2).max(80),
        verificationNote: z.string().trim().min(10).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const place = await context.supabase
      .from("places")
      .select("id")
      .eq("id", data.placeId)
      .eq("status", "approved")
      .maybeSingle();
    if (!place.data) throw new Error("Choose an approved restaurant.");
    const { error } = await (context.supabase as any).from("restaurant_claims").insert({
      place_id: data.placeId,
      requested_by: context.userId,
      business_role: data.businessRole,
      verification_note: data.verificationNote,
    });
    if (error) {
      if (missingRestaurantSchema(error)) return { ok: false, available: false };
      if (error.code === "23505") throw new Error("You already have an active claim for this restaurant.");
      throw new Error(error.message);
    }
    return { ok: true, available: true };
  });

export const getMyRestaurantWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [claims, memberships] = await Promise.all([
      (context.supabase as any)
        .from("restaurant_claims")
        .select("id, place_id, business_role, status, review_note, created_at, place:places(name)")
        .eq("requested_by", context.userId)
        .order("created_at", { ascending: false }),
      (context.supabase as any)
        .from("restaurant_memberships")
        .select("place_id, role, place:places(id, name, address, google_maps_url)")
        .eq("user_id", context.userId),
    ]);
    const firstError = claims.error || memberships.error;
    if (firstError) {
      if (missingRestaurantSchema(firstError)) {
        return { available: false, claims: [], restaurants: [] };
      }
      throw new Error(firstError.message);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const restaurants = await Promise.all(
      (memberships.data ?? []).map(async (membership: any) => {
        const [profile, permissions, sent, gallery, updates] = await Promise.all([
          (supabaseAdmin as any)
            .from("restaurant_profiles")
            .select("place_id, is_verified, official_description, menu_url, reservation_url, logo_url, cover_url, line_url, instagram_url, phone, subscription_tier, subscription_status, trial_started_at, trial_ends_at")
            .eq("place_id", membership.place_id)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("restaurant_contact_permissions")
            .select("user_id, allow_messages, allow_vouchers, granted_at, source_dish_id")
            .eq("place_id", membership.place_id)
            .is("revoked_at", null)
            .order("granted_at", { ascending: false }),
          (supabaseAdmin as any)
            .from("restaurant_outreach")
            .select("id, recipient_user_id, kind, subject, created_at, read_at, redeemed_at")
            .eq("place_id", membership.place_id)
            .order("created_at", { ascending: false })
            .limit(50),
          (supabaseAdmin as any)
            .from("restaurant_gallery_photos")
            .select("id, photo_url, caption, display_order, created_at")
            .eq("place_id", membership.place_id)
            .order("display_order")
            .order("created_at"),
          (supabaseAdmin as any)
            .from("restaurant_updates")
            .select("id, title, body, photo_url, cta_label, cta_url, published_at, expires_at, is_active")
            .eq("place_id", membership.place_id)
            .order("published_at", { ascending: false })
            .limit(20),
        ]);
        for (const result of [profile, permissions, sent]) {
          if (result.error) throw new Error(result.error.message);
        }
        const galleryRows = gallery.error && missingRestaurantSchema(gallery.error) ? [] : gallery.data ?? [];
        const updateRows = updates.error && missingRestaurantSchema(updates.error) ? [] : updates.data ?? [];
        if (gallery.error && !missingRestaurantSchema(gallery.error)) throw new Error(gallery.error.message);
        if (updates.error && !missingRestaurantSchema(updates.error)) throw new Error(updates.error.message);
        const hasGrowth = growthActive(profile.data);
        const visiblePermissions = hasGrowth ? permissions.data ?? [] : [];
        const userIds = visiblePermissions.map((item: any) => item.user_id);
        const profiles = userIds.length
          ? await (supabaseAdmin as any)
              .from("profiles")
              .select("id, display_name, username, avatar_url")
              .in("id", userIds)
          : { data: [] };
        const profileById = new Map((profiles.data ?? []).map((item: any) => [item.id, item]));
        return {
          ...membership,
          profile: profile.data ?? null,
          audience: visiblePermissions.map((item: any) => ({
            ...item,
            diner: profileById.get(item.user_id) ?? { id: item.user_id },
          })),
          sent: hasGrowth ? sent.data ?? [] : [],
          gallery: galleryRows,
          updates: updateRows,
        };
      }),
    );
    return { available: true, claims: claims.data ?? [], restaurants };
  });

export const updateRestaurantProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      placeId: string;
      officialDescription?: string;
      menuUrl?: string;
      lineUrl?: string;
      instagramUrl?: string;
      phone?: string;
      reservationUrl?: string;
      logoUrl?: string;
      coverUrl?: string;
    }) =>
      z
        .object({
          placeId: z.string().uuid(),
          officialDescription: z.string().trim().max(1000).optional(),
          menuUrl: optionalUrl.optional(),
          lineUrl: optionalUrl.optional(),
          instagramUrl: optionalUrl.optional(),
          phone: z.string().trim().max(40).optional(),
          reservationUrl: optionalUrl.optional(),
          logoUrl: optionalPhotoUrl.optional(),
          coverUrl: optionalPhotoUrl.optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const membership = await (context.supabase as any)
      .from("restaurant_memberships")
      .select("place_id")
      .eq("place_id", data.placeId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership.data) throw new Error("Verified restaurant access is required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("restaurant_profiles")
      .update({
        official_description: data.officialDescription || null,
        menu_url: data.menuUrl || null,
        line_url: data.lineUrl || null,
        instagram_url: data.instagramUrl || null,
        phone: data.phone || null,
        reservation_url: data.reservationUrl || null,
        logo_url: data.logoUrl || null,
        cover_url: data.coverUrl || null,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("place_id", data.placeId)
      .eq("is_verified", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function requireRestaurantMembership(context: any, placeId: string) {
  const membership = await (context.supabase as any)
    .from("restaurant_memberships")
    .select("place_id")
    .eq("place_id", placeId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!membership.data) throw new Error("Verified restaurant access is required.");
  return membership.data;
}

async function requireGrowth(context: any, placeId: string) {
  await requireRestaurantMembership(context, placeId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const profile = await (supabaseAdmin as any)
    .from("restaurant_profiles")
    .select("subscription_tier, subscription_status, trial_ends_at")
    .eq("place_id", placeId)
    .maybeSingle();
  if (!growthActive(profile.data)) throw new Error("Start or activate Growth to use this feature.");
  return supabaseAdmin;
}

export const startRestaurantGrowthTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { placeId: string }) =>
    z.object({ placeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireRestaurantMembership(context, data.placeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const current = await (supabaseAdmin as any)
      .from("restaurant_profiles")
      .select("trial_started_at, subscription_status")
      .eq("place_id", data.placeId)
      .maybeSingle();
    if (!current.data) throw new Error("Restaurant profile not found.");
    if (current.data.subscription_status === "active") {
      throw new Error("Growth is already active for this restaurant.");
    }
    if (current.data.trial_started_at) throw new Error("The Growth trial has already been used.");
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const { error } = await (supabaseAdmin as any)
      .from("restaurant_profiles")
      .update({
        subscription_tier: "growth",
        subscription_status: "trialing",
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        updated_by: context.userId,
        updated_at: now.toISOString(),
      })
      .eq("place_id", data.placeId);
    if (error) throw new Error(error.message);
    return { ok: true, trialEndsAt: trialEnd.toISOString() };
  });

export const addRestaurantGalleryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { placeId: string; photoUrl: string; caption?: string }) =>
    z.object({
      placeId: z.string().uuid(),
      photoUrl: z.string().trim().startsWith("/photos/").max(700),
      caption: z.string().trim().max(160).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireGrowth(context, data.placeId);
    const count = await (supabaseAdmin as any)
      .from("restaurant_gallery_photos")
      .select("id", { count: "exact", head: true })
      .eq("place_id", data.placeId);
    if ((count.count ?? 0) >= 12) throw new Error("A restaurant gallery can contain up to 12 photos.");
    const { error } = await (supabaseAdmin as any).from("restaurant_gallery_photos").insert({
      place_id: data.placeId,
      photo_url: data.photoUrl,
      caption: data.caption || null,
      display_order: count.count ?? 0,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRestaurantGalleryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { placeId: string; photoId: string }) =>
    z.object({ placeId: z.string().uuid(), photoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireGrowth(context, data.placeId);
    const { error } = await (supabaseAdmin as any)
      .from("restaurant_gallery_photos")
      .delete()
      .eq("id", data.photoId)
      .eq("place_id", data.placeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createRestaurantUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    placeId: string;
    title: string;
    body: string;
    photoUrl?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    expiresAt?: string;
  }) =>
    z.object({
      placeId: z.string().uuid(),
      title: z.string().trim().min(2).max(100),
      body: z.string().trim().min(2).max(1000),
      photoUrl: z.string().trim().startsWith("/photos/").max(700).optional(),
      ctaLabel: z.string().trim().max(40).optional(),
      ctaUrl: optionalUrl.optional(),
      expiresAt: z.string().datetime().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireGrowth(context, data.placeId);
    const { error } = await (supabaseAdmin as any).from("restaurant_updates").insert({
      place_id: data.placeId,
      title: data.title,
      body: data.body,
      photo_url: data.photoUrl || null,
      cta_label: data.ctaLabel || null,
      cta_url: data.ctaUrl || null,
      expires_at: data.expiresAt || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRestaurantUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { placeId: string; updateId: string }) =>
    z.object({ placeId: z.string().uuid(), updateId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireGrowth(context, data.placeId);
    const { error } = await (supabaseAdmin as any)
      .from("restaurant_updates")
      .delete()
      .eq("id", data.updateId)
      .eq("place_id", data.placeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRestaurantContactPermission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { placeId: string }) =>
    z.object({ placeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const result = await (context.supabase as any)
      .from("restaurant_contact_permissions")
      .select("place_id, source_dish_id, allow_messages, allow_vouchers, revoked_at")
      .eq("place_id", data.placeId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (result.error) {
      if (missingRestaurantSchema(result.error)) return { available: false, permission: null };
      throw new Error(result.error.message);
    }
    return { available: true, permission: result.data ?? null };
  });

export const setRestaurantContactPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      placeId: string;
      sourceDishId: string;
      allowMessages: boolean;
      allowVouchers: boolean;
    }) =>
      z
        .object({
          placeId: z.string().uuid(),
          sourceDishId: z.string().uuid(),
          allowMessages: z.boolean(),
          allowVouchers: z.boolean(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const dish = await context.supabase
      .from("dishes")
      .select("id, place_id")
      .eq("id", data.sourceDishId)
      .eq("place_id", data.placeId)
      .eq("status", "approved")
      .maybeSingle();
    if (!dish.data) throw new Error("This dish is not eligible.");
    const [tried, wanted] = await Promise.all([
      context.supabase
        .from("dish_tries")
        .select("dish_id")
        .eq("dish_id", data.sourceDishId)
        .eq("user_id", context.userId)
        .maybeSingle(),
      (context.supabase as any)
        .from("dish_wants")
        .select("dish_id")
        .eq("dish_id", data.sourceDishId)
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    if (!tried.data && !wanted.data) {
      throw new Error("Mark this dish as Tried or Want to try before connecting.");
    }
    const revoke = !data.allowMessages && !data.allowVouchers;
    const { error } = await (context.supabase as any)
      .from("restaurant_contact_permissions")
      .upsert(
        {
          place_id: data.placeId,
          user_id: context.userId,
          source_dish_id: data.sourceDishId,
          allow_messages: data.allowMessages,
          allow_vouchers: data.allowVouchers,
          granted_at: new Date().toISOString(),
          revoked_at: revoke ? new Date().toISOString() : null,
        },
        { onConflict: "place_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendRestaurantOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      placeId: string;
      recipientUserId: string;
      kind: "message" | "voucher";
      subject: string;
      body: string;
      voucherTerms?: string;
      expiresAt?: string;
    }) =>
      z
        .object({
          placeId: z.string().uuid(),
          recipientUserId: z.string().uuid(),
          kind: z.enum(["message", "voucher"]),
          subject: z.string().trim().min(1).max(100),
          body: z.string().trim().min(1).max(1000),
          voucherTerms: z.string().trim().max(500).optional(),
          expiresAt: z.string().datetime().optional(),
        })
        .superRefine((value, issue) => {
          if (value.kind === "voucher" && !value.expiresAt) {
            issue.addIssue({ code: "custom", message: "Voucher expiry is required." });
          }
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireGrowth(context, data.placeId);
    const consent = await (supabaseAdmin as any)
      .from("restaurant_contact_permissions")
      .select("allow_messages, allow_vouchers, revoked_at")
      .eq("place_id", data.placeId)
      .eq("user_id", data.recipientUserId)
      .is("revoked_at", null)
      .maybeSingle();
    if (consent.error) throw new Error(consent.error.message);
    const permitted =
      data.kind === "message"
        ? Boolean(consent.data?.allow_messages)
        : Boolean(consent.data?.allow_vouchers);
    if (!permitted) throw new Error("This diner has not permitted this outreach.");
    const { error } = await (supabaseAdmin as any).from("restaurant_outreach").insert({
      place_id: data.placeId,
      sender_user_id: context.userId,
      recipient_user_id: data.recipientUserId,
      kind: data.kind,
      subject: data.subject,
      body: data.body,
      voucher_code: data.kind === "voucher" ? generateVoucherNumber() : null,
      voucher_terms: data.kind === "voucher" ? data.voucherTerms || null : null,
      expires_at: data.kind === "voucher" ? data.expiresAt : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyRestaurantOutreach = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await (context.supabase as any)
      .from("restaurant_outreach")
      .select("id, place_id, kind, subject, body, voucher_code, voucher_terms, expires_at, read_at, redeemed_at, created_at, place:places(name)")
      .eq("recipient_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (result.error) {
      if (missingRestaurantSchema(result.error)) return { available: false, items: [] };
      throw new Error(result.error.message);
    }
    return { available: true, items: result.data ?? [] };
  });

export const updateRestaurantOutreachState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { outreachId: string; action: "read" | "redeem" }) =>
    z.object({ outreachId: z.string().uuid(), action: z.enum(["read", "redeem"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch =
      data.action === "read"
        ? { read_at: new Date().toISOString() }
        : { redeemed_at: new Date().toISOString(), read_at: new Date().toISOString() };
    const { error } = await (context.supabase as any)
      .from("restaurant_outreach")
      .update(patch)
      .eq("id", data.outreachId)
      .eq("recipient_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPublicRestaurantSummary = createServerFn({ method: "GET" })
  .inputValidator((input: { placeId: string }) =>
    z.object({ placeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await (supabaseAdmin as any)
      .from("restaurant_profiles")
      .select("place_id, is_verified")
      .eq("place_id", data.placeId)
      .eq("is_verified", true)
      .maybeSingle();
    if (result.error) {
      if (missingRestaurantSchema(result.error)) return null;
      throw new Error(result.error.message);
    }
    return result.data;
  });

export const getPublicRestaurantProfile = createServerFn({ method: "GET" })
  .inputValidator((input: { placeId: string }) =>
    z.object({ placeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const profile = await (supabaseAdmin as any)
      .from("restaurant_profiles")
      .select("place_id, is_verified, official_description, menu_url, reservation_url, logo_url, cover_url, line_url, instagram_url, phone, place:places(id, name, address, google_maps_url, area:areas(name_en, name_th))")
      .eq("place_id", data.placeId)
      .eq("is_verified", true)
      .maybeSingle();
    if (profile.error) {
      if (missingRestaurantSchema(profile.error)) return null;
      throw new Error(profile.error.message);
    }
    if (!profile.data) return null;
    const [dishes, gallery, updates] = await Promise.all([
      (supabaseAdmin as any)
        .from("dishes")
        .select("id, name_en, name_th, photo_url, comparisons_count, elo, status, place:places(id, name)")
        .eq("place_id", data.placeId)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(60),
      (supabaseAdmin as any)
        .from("restaurant_gallery_photos")
        .select("id, photo_url, caption, display_order")
        .eq("place_id", data.placeId)
        .order("display_order")
        .limit(12),
      (supabaseAdmin as any)
        .from("restaurant_updates")
        .select("id, title, body, photo_url, cta_label, cta_url, published_at, expires_at")
        .eq("place_id", data.placeId)
        .eq("is_active", true)
        .lte("published_at", new Date().toISOString())
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("published_at", { ascending: false })
        .limit(12),
    ]);
    if (dishes.error) throw new Error(dishes.error.message);
    if (gallery.error && !missingRestaurantSchema(gallery.error)) {
      throw new Error(gallery.error.message);
    }
    if (updates.error && !missingRestaurantSchema(updates.error)) {
      throw new Error(updates.error.message);
    }
    return {
      ...profile.data,
      dishes: dishes.data ?? [],
      gallery: gallery.error && missingRestaurantSchema(gallery.error) ? [] : gallery.data ?? [],
      updates: updates.error && missingRestaurantSchema(updates.error) ? [] : updates.data ?? [],
    };
  });
