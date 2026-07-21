import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

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
  needs_update, created_at,
  category:categories(id, slug, name_en, name_th),
  subtype:dish_subtypes(id, slug, name_en, name_th, is_active),
  place:places(id, name, area:areas(id, slug, name_en, name_th))
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
  place:places!inner(id, name, area:areas(id, slug, name_en, name_th))
`;

async function withTriedCounts(supabase: ReturnType<typeof publicClient>, rows: any[]) {
  if (rows.length === 0) return rows;
  const ids = rows.map((row) => row.id).filter(Boolean);
  const { data, error } = await supabase.from("dish_tries").select("dish_id").in("dish_id", ids);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.dish_id] = (counts[row.dish_id] ?? 0) + 1;
  return rows.map((row) => ({ ...row, tried_count: counts[row.id] ?? 0 }));
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

export const listDishes = createServerFn({ method: "GET" })
  .inputValidator((i: { categorySlug?: string; areaSlug?: string; subtypeSlug?: string }) => i ?? {})
  .handler(async ({ data }) => {
    const supabase = publicClient();
    // Resolve slug filters to ids so filtering runs in Postgres, not JS.
    const [catRes, areaRes] = await Promise.all([
      data.categorySlug
        ? supabase.from("categories").select("id").eq("slug", data.categorySlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      data.areaSlug
        ? supabase.from("areas").select("id").eq("slug", data.areaSlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);
    if (data.categorySlug && !catRes.data) return [];
    if (data.areaSlug && !areaRes.data) return [];
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
    let q = data.areaSlug
      ? supabase.from("dishes").select(dishSelectInner)
      : supabase.from("dishes").select(dishSelect);
    q = q.eq("status", "approved").order("elo", { ascending: false });
    if (catRes.data) q = q.eq("category_id", catRes.data.id);
    if (subtypeRes.data) q = q.eq("subtype_id", subtypeRes.data.id);
    if (areaRes.data) q = q.eq("place.area_id", areaRes.data.id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return withTriedCounts(
      supabase,
      (rows ?? []).filter((row: any) => !row.subtype_id || row.subtype?.is_active),
    );
  });

export const getDish = createServerFn({ method: "GET" })
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: dish, error } = await supabase
      .from("dishes")
      .select(dishSelect)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return dish ? (await withTriedCounts(supabase, [dish]))[0] : dish;
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("categories")
    .select("*, cuisine_ref:cuisines(slug, name_en, name_th), subtypes:dish_subtypes(id, slug, name_en, name_th, display_order)")
    .order("name_en");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listCuisines = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("cuisines").select("*").order("name_en");
  if (error) throw new Error(error.message);
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
  const { data, error } = await publicClient().from("dishes").select("category_id").eq("status", "approved");
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
            .select("id, name, area:areas(name_en, name_th)")
            .ilike("name", `%${data.placeName}%`)
            .limit(5)
        ).data ?? [])
      : [];
    const dishes = data.dishName
      ? ((
          await supabase
            .from("dishes")
            .select("id, name_en, name_th, place:places(name)")
            .eq("status", "approved")
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

export const submitDish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      name_en: string;
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
          name_en: z.string().trim().min(1).max(120),
          name_th: z.string().trim().max(120).optional(),
          place_id: z.string().uuid().optional(),
          place_name: z.string().trim().max(160).optional(),
          area_id: z.string().uuid().optional(),
          address: z.string().trim().max(300).optional(),
          category_id: z.string().uuid().optional(),
          requested_category_en: z.string().trim().max(80).optional(),
          requested_category_th: z.string().trim().max(80).optional(),
          subtype_id: z.string().uuid().optional(),
          price_thb: z.number().min(0).max(100000).optional(),
          photo_url: imageUrlSchema,
          note: z.string().trim().max(500).optional(),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!data.category_id && !data.requested_category_en) throw new Error("Category required");
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
    const { data: dupe, error: dupeError } = await context.supabase
      .from("dishes")
      .select("id")
      .eq("place_id", placeId)
      .ilike("name_en", data.name_en)
      .limit(1);
    if (dupeError) throw new Error(dupeError.message);
    if ((dupe ?? []).length > 0) throw new Error("This dish already exists at the selected place");
    const { data: dish, error } = await context.supabase
      .from("dishes")
      .insert({
        name_en: data.name_en,
        name_th: data.name_th,
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
    if (error) throw new Error(error.message);
    return { id: dish.id };
  });

export const toggleTried = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { dishId: string; tried: boolean }) =>
    z.object({ dishId: z.string().uuid(), tried: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.tried) {
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
    const { data: subtypes, error: se } = await context.supabase
      .from("dish_subtypes")
      .select("id, category_id, is_active")
      .in("category_id", [dishes[0].category_id, dishes[1].category_id]);
    if (se) throw new Error(se.message);
    const activeSubtypes = (subtypes ?? []).filter((s: any) => s.is_active);
    const hasActiveSubtypes = activeSubtypes.some((s: any) => s.category_id === dishes[0].category_id);
    if (hasActiveSubtypes) {
      if (!dishes[0].subtype_id || !dishes[1].subtype_id || dishes[0].subtype_id !== dishes[1].subtype_id)
        throw new Error("Dishes must be the same dish type");
      if (!activeSubtypes.some((s: any) => s.id === dishes[0].subtype_id))
        throw new Error("Dish type is inactive");
    } else if (dishes[0].subtype_id || dishes[1].subtype_id) {
      throw new Error("Dish type is not valid for this category");
    }
    const lo = data.dishAId < data.dishBId ? data.dishAId : data.dishBId;
    const hi = data.dishAId < data.dishBId ? data.dishBId : data.dishAId;

    const { data: existing } = await context.supabase
      .from("comparisons")
      .select("id, winner_id")
      .eq("user_id", context.userId)
      .eq("dish_lo_id", lo)
      .eq("dish_hi_id", hi)
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase
        .from("comparisons")
        .update({ winner_id: data.winnerId })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: re } = await supabaseAdmin.rpc("apply_elo", {
        _a: lo,
        _b: hi,
        _winner: data.winnerId,
        _prev_winner: existing.winner_id,
        _is_update: true,
      });
      if (re) throw new Error(re.message);
    } else {
      const { error } = await context.supabase.from("comparisons").insert({
        user_id: context.userId,
        category_id: dishes[0].category_id,
        dish_lo_id: lo,
        dish_hi_id: hi,
        winner_id: data.winnerId,
      });
      if (error) throw new Error(error.message);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: re } = await supabaseAdmin.rpc("apply_elo", {
        _a: lo,
        _b: hi,
        _winner: data.winnerId,
        _prev_winner: data.winnerId,
        _is_update: false,
      });
      if (re) throw new Error(re.message);
    }
    return { ok: true };
  });

export const myProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [tried, compared] = await Promise.all([
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
    ]);
    return { tried: tried.data ?? [], compared: compared.data ?? [] };
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
      supabase.from("categories").select("id").eq("slug", data.categorySlug).maybeSingle(),
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
    const hasActiveSubtypes = (activeSubtypes ?? []).length > 0;
    const subtype = data.subtypeSlug
      ? (activeSubtypes ?? []).find((s: any) => s.slug === data.subtypeSlug)
      : null;
    if (hasActiveSubtypes && !subtype) return [];
    let q = data.areaSlug
      ? supabase.from("dishes").select(dishSelectInner)
      : supabase.from("dishes").select(dishSelect);
    q = q
      .eq("status", "approved")
      .eq("category_id", catRes.data.id)
      .gte("comparisons_count", data.minimumComparisons ?? 5)
      .order("elo", { ascending: false })
      .limit(50);
    if (hasActiveSubtypes) q = q.eq("subtype_id", subtype.id);
    else q = q.is("subtype_id", null);
    if (areaRes.data) q = q.eq("place.area_id", areaRes.data.id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return withTriedCounts(supabase, rows ?? []);
  });
