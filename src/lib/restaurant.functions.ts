import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const missingRestaurantSchema = (error: any) => error?.code === "42P01";
const optionalUrl = z.string().trim().url().max(500).or(z.literal(""));

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
        const [profile, permissions, sent] = await Promise.all([
          (supabaseAdmin as any)
            .from("restaurant_profiles")
            .select("place_id, is_verified, official_description, menu_url, line_url, instagram_url, phone")
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
        ]);
        const userIds = (permissions.data ?? []).map((item: any) => item.user_id);
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
          audience: (permissions.data ?? []).map((item: any) => ({
            ...item,
            diner: profileById.get(item.user_id) ?? { id: item.user_id },
          })),
          sent: sent.data ?? [],
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
    }) =>
      z
        .object({
          placeId: z.string().uuid(),
          officialDescription: z.string().trim().max(1000).optional(),
          menuUrl: optionalUrl.optional(),
          lineUrl: optionalUrl.optional(),
          instagramUrl: optionalUrl.optional(),
          phone: z.string().trim().max(40).optional(),
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
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("place_id", data.placeId)
      .eq("is_verified", true);
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
      voucherCode?: string;
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
          voucherCode: z.string().trim().min(3).max(60).optional(),
          voucherTerms: z.string().trim().max(500).optional(),
          expiresAt: z.string().datetime().optional(),
        })
        .superRefine((value, issue) => {
          if (value.kind === "voucher" && (!value.voucherCode || !value.expiresAt)) {
            issue.addIssue({ code: "custom", message: "Voucher code and expiry are required." });
          }
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
    const { error } = await (supabaseAdmin as any).from("restaurant_outreach").insert({
      place_id: data.placeId,
      sender_user_id: context.userId,
      recipient_user_id: data.recipientUserId,
      kind: data.kind,
      subject: data.subject,
      body: data.body,
      voucher_code: data.kind === "voucher" ? data.voucherCode : null,
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
      .select("place_id, is_verified, official_description, menu_url, line_url, instagram_url, phone, place:places(id, name, address, google_maps_url, area:areas(name_en, name_th))")
      .eq("place_id", data.placeId)
      .eq("is_verified", true)
      .maybeSingle();
    if (!profile.data) return null;
    const dishes = await (supabaseAdmin as any)
      .from("dishes")
      .select("id, name_en, name_th, photo_url, comparisons_count, elo, status, place:places(id, name)")
      .eq("place_id", data.placeId)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(60);
    return { ...profile.data, dishes: dishes.data ?? [] };
  });
