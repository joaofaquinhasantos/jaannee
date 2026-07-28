import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

export { PUBLIC_RANK_THRESHOLD };

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const dishSelect = `
  id, name_en, name_th, price_thb, photo_url, note, status, elo, comparisons_count,
  subtype_id,
  needs_update, created_at, submitted_by,
  category:categories(id, slug, name_en, name_th),
  subtype:dish_subtypes(id, slug, name_en, name_th, is_active),
  place:places(id, name, address, lat, lng, area:areas(id, slug, name_en, name_th))
`;

// Same shape but with an inner join on places so we can filter dishes by
// place.area_id server-side (outer joins can't be filtered without dropping
// dishes whose place row would otherwise be null).
const dishSelectInner = `
  id, name_en, name_th, price_thb, photo_url, note, status, elo, comparisons_count,
  subtype_id,
  needs_update, created_at,
  category:categories(id, slug, name_en, name_th),
  subtype:dish_subtypes(id, slug, name_en, name_th, is_active),
  place:places!inner(id, name, address, lat, lng, area:areas(id, slug, name_en, name_th))
`;

export function mapsDirectionsUrl(place: { name?: string | null; address?: string | null; lat?: number | null; lng?: number | null }) {
  const query =
    place.lat != null && place.lng != null
      ? `${place.lat},${place.lng}`
      : [place.name, place.address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

async function withTriedCounts<T extends { id: string }>(
  supabase: ReturnType<typeof publicClient>,
  rows: T[],
): Promise<Array<T & { tried_count: number }>> {
  if (rows.length === 0) return rows as Array<T & { tried_count: number }>;
  const ids = rows.map((row) => row.id).filter(Boolean);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("get_dish_tried_counts", { _dish_ids: ids });
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { dish_id: string; tries_count: number }[]) {
    counts[row.dish_id] = Number(row.tries_count) || 0;
  }
  return rows.map((row) => ({ ...row, tried_count: counts[row.id] ?? 0 }));
}

// Public discovery ordering. Ranked dishes (>= PUBLIC_RANK_THRESHOLD
// comparisons) come first, ordered by Elo desc, then comparisons desc,
// then created_at desc, then id. Unranked contenders come after, ordered
// by comparisons desc, then tried_count desc, then created_at desc, then
// id. Elo is never used to order contenders.
function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dateTs(v: unknown): number {
  if (typeof v !== "string" && !(v instanceof Date)) return 0;
  const t = new Date(v as string).getTime();
  return Number.isFinite(t) ? t : 0;
}

export type DiscoveryRow = {
  id?: string | null;
  elo?: number | null;
  comparisons_count?: number | null;
  tried_count?: number | null;
  created_at?: string | null;
};

export function orderDiscoveryDishes<T extends DiscoveryRow>(rows: T[]): T[] {
  const ranked: T[] = [];
  const contenders: T[] = [];
  for (const row of rows) {
    if (num(row.comparisons_count) >= PUBLIC_RANK_THRESHOLD) ranked.push(row);
    else contenders.push(row);
  }
  ranked.sort((a, b) => {
    const eloDiff = num(b.elo) - num(a.elo);
    if (eloDiff !== 0) return eloDiff;
    const cmpDiff = num(b.comparisons_count) - num(a.comparisons_count);
    if (cmpDiff !== 0) return cmpDiff;
    const dateDiff = dateTs(b.created_at) - dateTs(a.created_at);
    if (dateDiff !== 0) return dateDiff;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
  contenders.sort((a, b) => {
    const cmpDiff = num(b.comparisons_count) - num(a.comparisons_count);
    if (cmpDiff !== 0) return cmpDiff;
    const triedDiff = num(b.tried_count) - num(a.tried_count);
    if (triedDiff !== 0) return triedDiff;
    const dateDiff = dateTs(b.created_at) - dateTs(a.created_at);
    if (dateDiff !== 0) return dateDiff;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
  return [...ranked, ...contenders];
}

const imageUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine(
    (v) => {
      if (!v) return true;
      if (/^\/photos\/[A-Za-z0-9._~!$&'()*+,;=:@/-]+$/i.test(v)) return true;
      if (!/^https?:\/\//i.test(v)) return false;
      try {
        const url = new URL(v);
        const imageExt = /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(url.pathname);
        const knownImageHost =
          /(^|\.)((cloudinary\.com)|(images\.unsplash\.com)|(imgur\.com)|(i\.imgur\.com)|(supabase\.co)|(lovableproject\.com))$/i.test(
            url.hostname,
          );
        return imageExt || knownImageHost;
      } catch {
        return false;
      }
    },
    { message: "Use an uploaded photo, a /photos/ path, or a direct image URL." },
  );

const optionalUuidSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().uuid().optional(),
);

export const listDishes = createServerFn({ method: "GET" })
  .inputValidator((i: { categorySlug?: string; areaSlug?: string; subtypeSlug?: string }) => i ?? {})
  .handler(async ({ data }) => {
    const supabase = publicClient();
    if (data.subtypeSlug && !data.categorySlug) return [];
    // Resolve slug filters to ids so filtering runs in Postgres, not JS.
    const [catRes, areaRes] = await Promise.all([
      data.categorySlug
        ? supabase.from("categories").select("id, requires_subtype").eq("slug", data.categorySlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      data.areaSlug
        ? supabase.from("areas").select("id").eq("slug", data.areaSlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);
    if (data.categorySlug && !catRes.data) return [];
    if (data.areaSlug && !areaRes.data) return [];
    // Detect subtype scoping so we never mix pools by Elo.
    let scoped = false;
    if (catRes.data) {
      const { data: activeSubs } = await supabase
        .from("dish_subtypes")
        .select("id")
        .eq("category_id", catRes.data.id)
        .eq("is_active", true);
      scoped = Boolean((catRes.data as any).requires_subtype) || (activeSubs ?? []).length > 0;
    }
    // Category-only pool: reject any supplied subtype filter.
    if (data.subtypeSlug && catRes.data && !scoped) return [];
    const subtypeRes =
      data.subtypeSlug && catRes.data
        ? await supabase
            .from("dish_subtypes")
            .select("id")
            .eq("category_id", catRes.data.id)
            .eq("slug", data.subtypeSlug)
            .eq("is_active", true)
            .maybeSingle()
        : { data: null, error: null };
    if (data.subtypeSlug && !subtypeRes.data) return [];
    if (data.categorySlug && !data.subtypeSlug && scoped && !data.subtypeSlug) {
      // Subtype-scoped category selected without a subtype: do not order
      // across pools by Elo. Callers should present a subtype picker.
      return [];
    }
    let q = data.areaSlug
      ? supabase.from("dishes").select(dishSelectInner)
      : supabase.from("dishes").select(dishSelect);
    q = q.eq("status", "approved").not("category_id", "is", null).order("elo", { ascending: false });
    if (catRes.data) q = q.eq("category_id", catRes.data.id);
    if (subtypeRes.data) q = q.eq("subtype_id", subtypeRes.data.id);
    // Category-only pool: exclude any legacy subtype-bearing dishes at the DB.
    else if (catRes.data && !scoped) q = q.is("subtype_id", null);
    if (areaRes.data) q = q.eq("place.area_id", areaRes.data.id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    type Row = {
      id: string;
      subtype_id: string | null;
      subtype?: { is_active?: boolean | null } | null;
      elo?: number | null;
      comparisons_count?: number | null;
      created_at?: string | null;
    };
    const filtered = ((rows ?? []) as unknown as Row[]).filter(
      (row) => !row.subtype_id || row.subtype?.is_active,
    );
    const hydrated = await withTriedCounts(supabase, filtered);
    return orderDiscoveryDishes(hydrated);
  });

export const getDish = createServerFn({ method: "GET" })
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: dish, error } = await supabase
      .from("dishes")
      .select(dishSelect)
      .not("category_id", "is", null)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!dish) return dish;
    const withCounts = (await withTriedCounts(supabase, [dish]))[0];
    if (!withCounts.submitted_by) return withCounts;
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .eq("id", withCounts.submitted_by)
      .maybeSingle();
    return { ...withCounts, submitter_profile: profile ?? null };
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*, cuisine_ref:cuisines(slug, name_en, name_th), subtypes:dish_subtypes(id, slug, name_en, name_th, display_order, is_active)")
    .order("name_en");
  if (error) {
    const fallback = await supabase
      .from("categories")
      .select("*, subtypes:dish_subtypes(id, slug, name_en, name_th, display_order, is_active)")
      .order("name_en");
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((category: any) => ({ ...category, cuisine_ref: null }));
  }
  return data ?? [];
});

export const listCuisines = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("cuisines").select("*").order("name_en");
  if (error) return [];
  return data ?? [];
});

export const listDishSubtypes = createServerFn({ method: "GET" })
  .inputValidator((i: { categoryId?: string; categorySlug?: string }) =>
    z.object({ categoryId: z.string().uuid().optional(), categorySlug: z.string().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    let categoryId = data.categoryId;
    if (!categoryId && data.categorySlug) {
      const { data: cat, error } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", data.categorySlug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      categoryId = cat?.id;
    }
    if (!categoryId) return [];
    const { data: rows, error } = await supabase
      .from("dish_subtypes")
      .select("id, category_id, slug, name_en, name_th, display_order")
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .order("display_order")
      .order("name_en");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAreas = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("areas").select("*").order("name_en");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listCategoryCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("dishes")
    .select("category_id")
    .eq("status", "approved")
    .not("category_id", "is", null);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
  return counts;
});

export const searchSimilar = createServerFn({ method: "GET" })
  .inputValidator((i: { placeName?: string; dishName?: string }) =>
    z
      .object({
        placeName: z.string().max(120).optional(),
        dishName: z.string().max(120).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const places = data.placeName
      ? ((
          await supabase
            .from("places")
            .select("id, name, area_id, address, area:areas(id, slug, name_en, name_th)")
            .ilike("name", `%${data.placeName}%`)
            .limit(5)
        ).data ?? [])
      : [];
    const dishes = data.dishName
      ? ((
          await supabase
            .from("dishes")
            .select(dishSelect)
            .eq("status", "approved")
            .not("category_id", "is", null)
            .ilike("name_en", `%${data.dishName}%`)
            .limit(5)
        ).data ?? [])
      : [];
    return { places, dishes };
  });

export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((i: { term: string }) => z.object({ term: z.string().trim().min(2).max(120) }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: matches, error } = await supabase.rpc("search_places_by_similarity", {
      _term: data.term.trim(),
    });
    if (error) throw new Error(error.message);
    const areaIds = [...new Set((matches ?? []).map((p: any) => p.area_id).filter(Boolean))];
    const { data: areas, error: areaError } = areaIds.length
      ? await supabase.from("areas").select("id, slug, name_en, name_th").in("id", areaIds)
      : { data: [], error: null };
    if (areaError) throw new Error(areaError.message);
    const areaById = new Map((areas ?? []).map((area: any) => [area.id, area]));
    const rows = (matches ?? []).map((place: any) => ({ ...place, area: areaById.get(place.area_id) ?? null }));
    return rows ?? [];
  });

export const listNearbyPlaces = createServerFn({ method: "GET" })
  .inputValidator((i: { lat: number; lng: number; radiusKm?: number; maxResults?: number }) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusKm: z.number().positive().max(50).optional(),
        maxResults: z.number().int().min(1).max(50).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    // nearby_places is service_role-only; run through the admin client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).rpc("nearby_places", {
      _lat: data.lat,
      _lng: data.lng,
      _radius_km: data.radiusKm ?? 1,
      _max_results: data.maxResults ?? 6,
    });
    if (error) throw new Error(error.message);
    // Hydrate area for parity with previous callers.
    const areaIds = [...new Set(((rows ?? []) as any[]).map((r) => r.area_id).filter(Boolean))];
    const { data: areas } = areaIds.length
      ? await (supabaseAdmin as any).from("areas").select("id, slug, name_en, name_th").in("id", areaIds)
      : { data: [] };
    const byId = new Map(((areas ?? []) as any[]).map((a) => [a.id, a]));
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      distance_m: Math.round(Number(r.distance_km) * 1000),
      area: byId.get(r.area_id) ?? null,
    }));
  });

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const submitDish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      name_en?: string;
      name_th?: string;
      place_id?: string;
      place_name?: string;
      area_id?: string;
      address?: string;
      category_id?: string;
      requested_category_en?: string;
      requested_category_th?: string;
      subtype_id?: string;
      price_thb?: number;
      photo_url?: string;
      note?: string;
    }) =>
      z
        .object({
          name_en: z.string().trim().max(120).optional(),
          name_th: z.string().trim().max(120).optional(),
          place_id: optionalUuidSchema,
          place_name: z.string().trim().max(160).optional(),
          area_id: optionalUuidSchema,
          address: z.string().trim().max(300).optional(),
          category_id: optionalUuidSchema,
          requested_category_en: z.string().trim().max(80).optional(),
          requested_category_th: z.string().trim().max(80).optional(),
          subtype_id: optionalUuidSchema,
          price_thb: z.number().min(0).max(100000).optional(),
          photo_url: imageUrlSchema,
          note: z.string().trim().max(500).optional(),
        })
        .refine((v) => Boolean(v.name_en?.trim() || v.name_th?.trim()), {
          message: "A dish name is required.",
          path: ["name_en"],
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!data.category_id && !data.requested_category_en) throw new Error("Category required");
    // The `dishes.name_en` column is NOT NULL. A Thai-first submission stores
    // the Thai name as a provisional English value so moderation can refine
    // it later; no schema change is made here.
    const nameTh = data.name_th?.trim() || undefined;
    const nameEn = data.name_en?.trim() || nameTh;
    if (!nameEn) throw new Error("A dish name is required.");
    let placeId = data.place_id;
    if (!placeId) {
      if (!data.place_name) throw new Error("Place required");
      const { data: place, error: pe } = await context.supabase
        .from("places")
        .insert({
          name: data.place_name,
          area_id: data.area_id,
          address: data.address,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (pe) throw new Error(pe.message);
      placeId = place.id;
    }
    const { data: dish, error } = await context.supabase
      .from("dishes")
      .insert({
        name_en: nameEn,
        name_th: nameTh,
        place_id: placeId,
        category_id: data.category_id ?? null,
        requested_category_en: data.category_id ? null : data.requested_category_en,
        requested_category_th: data.category_id ? null : data.requested_category_th,
        subtype_id: data.subtype_id,
        price_thb: data.price_thb,
        photo_url: data.photo_url,
        note: data.note,
        status: "pending",
        submitted_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      if ((error as any).code === "23505") {
        throw new Error("This dish already exists at the selected restaurant.");
      }
      throw new Error(error.message);
    }
    return { id: dish.id };
  });

export const toggleTried = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { dishId: string; tried: boolean }) =>
    z.object({ dishId: z.string().uuid(), tried: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.tried) {
      const { data: dish, error: dishError } = await context.supabase
        .from("dishes")
        .select("id")
        .eq("id", data.dishId)
        .eq("status", "approved")
        .maybeSingle();
      if (dishError) throw new Error(dishError.message);
      if (!dish) throw new Error("Only approved dishes can be marked as tried.");
      const { error } = await context.supabase
        .from("dish_tries")
        .upsert(
          { user_id: context.userId, dish_id: data.dishId },
          { onConflict: "user_id,dish_id", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("dish_tries")
        .delete()
        .eq("user_id", context.userId)
        .eq("dish_id", data.dishId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Returns the approved dishes the currently authenticated diner has marked
// as tried, with the fields /compare needs to build tried-only pickers and
// enforce the ranking-pool rule. RLS on dish_tries scopes reads to the
// caller, so we never expose another user's tried marks.
export const listCurrentUserTriedDishes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("dish_tries")
      .select(
        `dish:dishes!inner(
          id, name_en, name_th, photo_url, status, subtype_id,
          category:categories!inner(id, slug, name_en, name_th, requires_subtype),
          subtype:dish_subtypes(id, slug, name_en, name_th, is_active),
          place:places(id, name)
        )`,
      )
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const dishes = ((data ?? []) as any[])
      .map((row) => row.dish)
      .filter(
        (d) =>
          d &&
          d.status === "approved" &&
          d.category &&
          (!d.subtype_id || d.subtype?.is_active),
      );
    // De-dupe just in case (unique index makes this defensive).
    const seen = new Set<string>();
    return dishes.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  });

export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; follow: boolean }) =>
    z.object({ userId: z.string().uuid(), follow: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You cannot follow yourself");
    if (data.follow) {
      const { error } = await (context.supabase as any)
        .from("follows")
        .upsert({ follower_id: context.userId, following_id: data.userId }, { onConflict: "follower_id,following_id" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (context.supabase as any)
        .from("follows")
        .delete()
        .eq("follower_id", context.userId)
        .eq("following_id", data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const myFollowingIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("follows")
      .select("following_id")
      .eq("follower_id", context.userId);
    if (error) return [];
    return (data ?? []).map((r: any) => r.following_id);
  });

export const listActivityFeed = createServerFn({ method: "GET" })
  .inputValidator((i: Record<string, never>) => i ?? {})
  .handler(async () => {
    const supabase = publicClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [triesRes, dishesRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("dish_tries")
        .select(`user_id, dish_id, created_at, dish:dishes(${dishSelect})`)
        .eq("dish.status", "approved")
        .order("created_at", { ascending: false })
        .limit(10),
      (supabase as any)
        .from("dishes")
        .select(dishSelect)
        .eq("status", "approved")
        .not("category_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    const raw = [
      ...((triesRes.data ?? []) as any[]).map((r) => ({ type: "tried", user_id: r.user_id, created_at: r.created_at, dish: r.dish })),
      ...((dishesRes.data ?? []) as any[]).map((d) => ({ type: "posted", user_id: d.submitted_by, created_at: d.created_at, dish: d })),
    ].filter((item) => item.dish?.id);
    const userIds = [...new Set(raw.map((r) => r.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await (supabase as any)
          .from("profiles")
          .select("id, display_name, username, avatar_url, tried_public")
          .in("id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return raw
      .map((item) => ({ ...item, profile: byId.get(item.user_id) ?? null }))
      .filter((item) => item.type !== "tried" || (item.profile as any)?.tried_public !== false)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
  });

export const listFollowingActivityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: follows } = await (context.supabase as any)
      .from("follows")
      .select("following_id")
      .eq("follower_id", context.userId);
    const followingIds = (follows ?? []).map((r: any) => r.following_id);
    if (followingIds.length === 0) return [];
    const supabase = publicClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [triesRes, dishesRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("dish_tries")
        .select(`user_id, dish_id, created_at, dish:dishes(${dishSelect})`)
        .in("user_id", followingIds)
        .eq("dish.status", "approved")
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase as any)
        .from("dishes")
        .select(dishSelect)
        .in("submitted_by", followingIds)
        .eq("status", "approved")
        .not("category_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const raw = [
      ...((triesRes.data ?? []) as any[]).map((r) => ({ type: "tried", user_id: r.user_id, created_at: r.created_at, dish: r.dish })),
      ...((dishesRes.data ?? []) as any[]).map((d) => ({ type: "posted", user_id: d.submitted_by, created_at: d.created_at, dish: d })),
    ].filter((item) => item.dish?.id);
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, display_name, username, avatar_url, tried_public")
      .in("id", followingIds);
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return raw
      .map((item) => ({ ...item, profile: byId.get(item.user_id) ?? null }))
      .filter((item) => item.type !== "tried" || (item.profile as any)?.tried_public !== false)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
  });

export const myTriedIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("dish_tries")
      .select("dish_id")
      .eq("user_id", context.userId);
    return (data ?? []).map((r) => r.dish_id);
  });

export const submitComparison = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { dishAId: string; dishBId: string; winnerId: string }) =>
    z
      .object({
        dishAId: z.string().uuid(),
        dishBId: z.string().uuid(),
        winnerId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.dishAId === data.dishBId) throw new Error("Choose two different dishes");
    if (data.winnerId !== data.dishAId && data.winnerId !== data.dishBId)
      throw new Error("Winner must be one of the two dishes");
    // submitComparison is the app write gate for comparisons. The database also
    // has comparisons_ranking_key_guard so future writes cannot bypass this rule.
    const { data: dishes, error: de } = await context.supabase
      .from("dishes")
      .select("id, category_id, subtype_id, status")
      .in("id", [data.dishAId, data.dishBId]);
    if (de) throw new Error(de.message);
    if (!dishes || dishes.length !== 2) throw new Error("Dishes not found");
    if (dishes[0].category_id !== dishes[1].category_id)
      throw new Error("Dishes must be in the same category");
    if (dishes.some((d) => d.status !== "approved"))
      throw new Error("Dish not available for comparison");
    // Tried-before-comparing: also validated at the DB layer by trg_comparisons_tried.
    const { data: tried, error: te } = await context.supabase
      .from("dish_tries")
      .select("dish_id")
      .eq("user_id", context.userId)
      .in("dish_id", [data.dishAId, data.dishBId]);
    if (te) throw new Error(te.message);
    if ((tried ?? []).length < 2) {
      throw new Error("Mark both dishes as tried before comparing them.");
    }
    const { data: catRow, error: catErr } = await context.supabase
      .from("categories")
      .select("id, requires_subtype")
      .eq("id", dishes[0].category_id!)
      .maybeSingle();
    if (catErr) throw new Error(catErr.message);
    const { data: subtypes, error: se } = await context.supabase
      .from("dish_subtypes")
      .select("id, category_id, is_active")
      .eq("category_id", dishes[0].category_id!);
    if (se) throw new Error(se.message);
    const activeSubtypes = (subtypes ?? []).filter((s: any) => s.is_active);
    const scoped = Boolean((catRow as any)?.requires_subtype) || activeSubtypes.length > 0;
    if (scoped) {
      if (!dishes[0].subtype_id || !dishes[1].subtype_id)
        throw new Error("Both dishes must have a dish type");
      if (dishes[0].subtype_id !== dishes[1].subtype_id)
        throw new Error("Dishes must be the same dish type");
      const match = activeSubtypes.find((s: any) => s.id === dishes[0].subtype_id);
      if (!match) throw new Error("Dish type is inactive or belongs to another category");
    } else if (dishes[0].subtype_id || dishes[1].subtype_id) {
      throw new Error("Dish type is not valid for this category");
    }
    const lo = data.dishAId < data.dishBId ? data.dishAId : data.dishBId;
    const hi = data.dishAId < data.dishBId ? data.dishBId : data.dishAId;

    // The service-role-only RPC inserts the immutable comparison. A database
    // trigger applies Elo and count updates in the same transaction.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: comparisonId, error } = await supabaseAdmin.rpc("submit_comparison_atomic", {
      _user_id: context.userId,
      _dish_a_id: lo,
      _dish_b_id: hi,
      _winner_id: data.winnerId,
    });
    if (error) {
      if (error.code === "23505" || error.message.includes("already compared")) {
        throw new Error("You have already compared these two dishes.");
      }
      throw new Error(error.message);
    }
    return { ok: true, comparisonId };
  });

export const myProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [tried, compared, profile, posted, followers, following] = await Promise.all([
      context.supabase
        .from("dish_tries")
        .select(`dish_id, created_at, dish:dishes(${dishSelect})`)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("comparisons")
        .select(
          `id, winner_id, updated_at,
        lo:dishes!comparisons_dish_lo_id_fkey(id, name_en, place:places(name)),
        hi:dishes!comparisons_dish_hi_id_fkey(id, name_en, place:places(name))`,
        )
        .eq("user_id", context.userId)
        .order("updated_at", { ascending: false }),
      (context.supabase as any)
        .from("profiles")
        .select("id, display_name, username, avatar_url, bio, tried_public")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("dishes")
        .select(dishSelect)
        .eq("submitted_by", context.userId)
        .order("created_at", { ascending: false }),
      (context.supabase as any).from("follows").select("follower_id").eq("following_id", context.userId),
      (context.supabase as any).from("follows").select("following_id").eq("follower_id", context.userId),
    ]);
    return {
      profile: profile.data ?? null,
      tried: tried.data ?? [],
      compared: compared.data ?? [],
      posted: posted.data ?? [],
      followers_count: followers.data?.length ?? 0,
      following_count: following.data?.length ?? 0,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { username?: string; displayName?: string; avatarUrl?: string; bio?: string; triedPublic?: boolean }) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9_]{3,24}$/, "Use 3-24 lowercase letters, numbers, or underscores.")
          .optional(),
        displayName: z.string().trim().max(80).optional(),
        avatarUrl: z.string().trim().url().max(500).or(z.literal("")).optional(),
        bio: z.string().trim().max(160).optional(),
        triedPublic: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.username !== undefined) patch.username = data.username;
    if (data.displayName !== undefined) patch.display_name = data.displayName || null;
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl || null;
    if (data.bio !== undefined) patch.bio = data.bio || null;
    if (data.triedPublic !== undefined) patch.tried_public = data.triedPublic;
    const { error } = await (context.supabase as any)
      .from("profiles")
      .upsert({ id: context.userId, ...patch }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publicProfile = createServerFn({ method: "GET" })
  .inputValidator((i: { username: string }) =>
    z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/) }).parse(i),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: profile, error } = await (supabase as any)
      .from("profiles")
      .select("id, display_name, username, avatar_url, bio, tried_public")
      .ilike("username", data.username)
      .maybeSingle();
    if (error || !profile?.username) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [tried, compared, counts] = await Promise.all([
      profile.tried_public
        ? (supabaseAdmin as any)
            .from("dish_tries")
            .select(`dish_id, created_at, dish:dishes(${dishSelect})`)
            .eq("user_id", profile.id)
            .eq("dish.status", "approved")
            .order("created_at", { ascending: false })
            .limit(24)
        : Promise.resolve({ data: [] }),
      (supabaseAdmin as any).from("comparisons").select("id").eq("user_id", profile.id),
      (supabaseAdmin as any).rpc("get_follow_counts", { _user_id: profile.id }).maybeSingle(),
    ]);
    return {
      profile,
      tried: tried.data ?? [],
      comparisons_count: compared.data?.length ?? 0,
      followers_count: Number((counts as any)?.data?.followers_count ?? 0),
      following_count: Number((counts as any)?.data?.following_count ?? 0),
    };
  });

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { dishId: string; reason: string; note?: string }) =>
    z
      .object({
        dishId: z.string().uuid(),
        reason: z.string().min(1).max(60),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reports").insert({
      dish_id: data.dishId,
      user_id: context.userId,
      reason: data.reason,
      note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaderboard = createServerFn({ method: "GET" })
  .inputValidator((i: { categorySlug: string; subtypeSlug?: string; areaSlug?: string; minimumComparisons?: number }) =>
    z
      .object({
        categorySlug: z.string(),
        subtypeSlug: z.string().optional(),
        areaSlug: z.string().optional(),
        minimumComparisons: z.number().min(0).max(100).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const [catRes, areaRes] = await Promise.all([
      supabase.from("categories").select("id, requires_subtype").eq("slug", data.categorySlug).maybeSingle(),
      data.areaSlug
        ? supabase.from("areas").select("id").eq("slug", data.areaSlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);
    if (!catRes.data) return [];
    if (data.areaSlug && !areaRes.data) return [];
    const { data: activeSubtypes, error: subErr } = await supabase
      .from("dish_subtypes")
      .select("id, slug")
      .eq("category_id", catRes.data.id)
      .eq("is_active", true);
    if (subErr) throw new Error(subErr.message);
    const scoped = Boolean((catRes.data as any).requires_subtype) || (activeSubtypes ?? []).length > 0;
    const subtype = data.subtypeSlug
      ? (activeSubtypes ?? []).find((s: any) => s.slug === data.subtypeSlug)
      : null;
    if (scoped && !subtype) return [];
    if (!scoped && data.subtypeSlug) return [];
    let q = data.areaSlug
      ? supabase.from("dishes").select(dishSelectInner)
      : supabase.from("dishes").select(dishSelect);
    q = q
      .eq("status", "approved")
      .not("category_id", "is", null)
      .eq("category_id", catRes.data.id)
      .gte(
        "comparisons_count",
        Math.max(PUBLIC_RANK_THRESHOLD, data.minimumComparisons ?? PUBLIC_RANK_THRESHOLD),
      )
      .order("elo", { ascending: false })
      .limit(50);
    if (scoped) q = q.eq("subtype_id", subtype!.id);
    else q = q.is("subtype_id", null);
    if (areaRes.data) q = q.eq("place.area_id", areaRes.data.id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return withTriedCounts(supabase, rows ?? []);
  });

// Pair keys (`lo:hi`) for every comparison the signed-in diner has already
// submitted. Used to exclude completed pairs from contextual comparison
// prompts. Comparison history itself is never modified here.
export const myComparedPairKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("comparisons")
      .select("dish_lo_id, dish_hi_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as { dish_lo_id: string; dish_hi_id: string }[]).map((row) =>
      row.dish_lo_id < row.dish_hi_id
        ? `${row.dish_lo_id}:${row.dish_hi_id}`
        : `${row.dish_hi_id}:${row.dish_lo_id}`,
    );
  });

// Public challenge pair. Loads only approved dishes and refuses to return a
// pair that is not in the exact same ranking pool, so a crafted URL can never
// present a cross-pool challenge.
export const getChallengePair = createServerFn({ method: "GET" })
  .inputValidator((i: { dishAId: string; dishBId: string }) =>
    z.object({ dishAId: z.string().uuid(), dishBId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    if (data.dishAId === data.dishBId) return { ok: false as const, reason: "same_dish" as const };
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("dishes")
      .select(dishSelect)
      .eq("status", "approved")
      .not("category_id", "is", null)
      .in("id", [data.dishAId, data.dishBId]);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    if (list.length !== 2) return { ok: false as const, reason: "not_found" as const };
    const a = list.find((d) => d.id === data.dishAId);
    const b = list.find((d) => d.id === data.dishBId);
    if (!a || !b) return { ok: false as const, reason: "not_found" as const };

    const categoryId = a.category?.id;
    if (!categoryId || categoryId !== b.category?.id)
      return { ok: false as const, reason: "different_pool" as const };

    const [{ data: catRow }, { data: subs }] = await Promise.all([
      supabase.from("categories").select("id, requires_subtype").eq("id", categoryId).maybeSingle(),
      supabase.from("dish_subtypes").select("id, is_active").eq("category_id", categoryId),
    ]);
    const activeSubtypes = ((subs ?? []) as any[]).filter((s) => s.is_active);
    const scoped = Boolean((catRow as any)?.requires_subtype) || activeSubtypes.length > 0;
    if (scoped) {
      if (!a.subtype_id || a.subtype_id !== b.subtype_id)
        return { ok: false as const, reason: "different_pool" as const };
      if (!activeSubtypes.some((s) => s.id === a.subtype_id))
        return { ok: false as const, reason: "different_pool" as const };
    } else if (a.subtype_id || b.subtype_id) {
      return { ok: false as const, reason: "different_pool" as const };
    }

    const hydrated = await withTriedCounts(supabase, [a, b]);
    return {
      ok: true as const,
      a: hydrated.find((d: any) => d.id === data.dishAId),
      b: hydrated.find((d: any) => d.id === data.dishBId),
    };
  });
