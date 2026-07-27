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
    const rows = (matches ?? []).map((place: any)ß_|¶‰žËkºwµçM½¹ÍÐÉ…Ü€ôl4(€€€€€€¸¸¸ ¡ÑÉ¥•ÍI•Ì¹‘…Ñ„€üümt¤…Ì…¹åmt¤¹µ…À ¡È¤€ôø€¡ìÑåÁ”è€‰ÑÉ¥•ˆ°ÕÍ•É}¥èÈ¹ÕÍ•É}¥°É•…Ñ•‘}…ÐèÈ¹É•…Ñ•‘}…Ð°‘¥Í èÈ¹‘¥Í ô¤¤°4(€€€€€€¸¸¸ ¡‘¥Í¡•ÍI•Ì¹‘…Ñ„€üümt¤…Ì…¹åmt¤¹µ…À ¡¤€ôø€¡ìÑåÁ”è€‰Á½ÍÑ•ˆ°ÕÍ•É}¥è¹ÍÕ‰µ¥ÑÑ•‘}‰ä°É•…Ñ•‘}…Ðè¹É•…Ñ•‘}…Ð°‘¥Í èô¤¤°4(€€€t¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹‘¥Í ü¹¥¤ì4(€€€½¹ÍÐÕÍ•É%‘Ì€ôl¸¸¹¹•ÜM•Ð¡É…Ü¹µ…À ¡È¤€ôøÈ¹ÕÍ•É}¥¤¹™¥±Ñ•È¡	½½±•…¸¤¥tì4(€€€½¹ÍÐì‘…Ñ„èÁÉ½™¥±•Ìô€ôÕÍ•É%‘Ì¹±•¹Ñ 4(€€€€€€ü…Ý…¥Ð€¡ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€€€€€¹™É½´ ‰ÁÉ½™¥±•Ìˆ¤4(€€€€€€€€€€¹Í•±•Ð ‰¥°‘¥ÍÁ±…å}¹…µ”°ÕÍ•É¹…µ”°…Ù…Ñ…É}ÕÉ°°ÑÉ¥•‘}ÁÕ‰±¥Œˆ¤4(€€€€€€€€€€¹¥¸ ‰¥ˆ°ÕÍ•É%‘Ì¤4(€€€€€€èì‘…Ñ„èmtôì4(€€€½¹ÍÐ‰å%€ô¹•Ü5…À ¡ÁÉ½™¥±•Ì€üümt¤¹µ…À ¡Àè…¹ä¤€ôømÀ¹¥°Át¤¤ì4(€€€É•ÑÕÉ¸É…Ü4(€€€€€€¹µ…À ¡¥Ñ•´¤€ôø€¡ì€¸¸¹¥Ñ•´°ÁÉ½™¥±”è‰å%¹•Ð¡¥Ñ•´¹ÕÍ•É}¥¤€üü¹Õ±°ô¤¤4(€€€€€€¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹ÑåÁ”€„ôô€‰ÑÉ¥•ˆñð€¡¥Ñ•´¹ÁÉ½™¥±”…Ì…¹ä¤ü¹ÑÉ¥•‘}ÁÕ‰±¥Œ€„ôô™…±Í”¤4(€€€€€€¹Í½ÉÐ ¡„°ˆ¤€ôø¹•Ü…Ñ”¡ˆ¹É•…Ñ•‘}…Ð¤¹•ÑQ¥µ” ¤€´¹•Ü…Ñ”¡„¹É•…Ñ•‘}…Ð¤¹•ÑQ¥µ” ¤¤4(€€€€€€¹Í±¥” À°€ÈÀ¤ì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐ±¥ÍÑ½±±½Ý¥¹Ñ¥Ù¥Ñå••€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰Pˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì½¹Ñ•áÐô¤€ôøì4(€€€½¹ÍÐì‘…Ñ„è™½±±½ÝÌô€ô…Ý…¥Ð€¡½¹Ñ•áÐ¹ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€¹™É½´ ‰™½±±½ÝÌˆ¤4(€€€€€€¹Í•±•Ð ‰™½±±½Ý¥¹}¥ˆ¤4(€€€€€€¹•Ä ‰™½±±½Ý•É}¥ˆ°½¹Ñ•áÐ¹ÕÍ•É%¤ì4(€€€½¹ÍÐ™½±±½Ý¥¹%‘Ì€ô€¡™½±±½ÝÌ€üümt¤¹µ…À ¡Èè…¹ä¤€ôøÈ¹™½±±½Ý¥¹}¥¤ì4(€€€¥˜€¡™½±±½Ý¥¹%‘Ì¹±•¹Ñ €ôôô€À¤É•ÑÕÉ¸mtì4(€€€½¹ÍÐÍÕÁ…‰…Í”€ôÁÕ‰±¥±¥•¹Ð ¤ì4(€€€½¹ÍÐìÍÕÁ…‰…Í•‘µ¥¸ô€ô…Ý…¥Ð¥µÁ½ÉÐ ‰ ½¥¹Ñ•É…Ñ¥½¹Ì½ÍÕÁ…‰…Í”½±¥•¹Ð¹Í•ÉÙ•Èˆ¤ì4(€€€½¹ÍÐmÑÉ¥•ÍI•Ì°‘¥Í¡•ÍI•Ít€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l4(€€€€€€¡ÍÕÁ…‰…Í•‘µ¥¸…Ì…¹ä¤4(€€€€€€€€¹™É½´ ‰‘¥Í¡}ÑÉ¥•Ìˆ¤4(€€€€€€€€¹Í•±•Ð¡ÕÍ•É}¥°‘¥Í¡}¥°É•…Ñ•‘}…Ð°‘¥Í é‘¥Í¡•Ì ‘í‘¥Í¡M•±•Ñô¥€¤(€€€€€€€€¹¥¸ ‰ÕÍ•É}¥ˆ°™½±±½Ý¥¹%‘Ì¤(€€€€€€€€¹•Ä ‰‘¥Í ¹ÍÑ…ÑÕÌˆ°€‰…ÁÁÉ½Ù•ˆ¤(€€€€€€€€¹½É‘•È ‰É•…Ñ•‘}…Ðˆ°ì…Í•¹‘¥¹œè™…±Í”ô¤4(€€€€€€€€¹±¥µ¥Ð ÈÀ¤°4(€€€€€€¡ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€€€¹™É½´ ‰‘¥Í¡•Ìˆ¤4(€€€€€€€€¹Í•±•Ð¡‘¥Í¡M•±•Ð¤4(€€€€€€€€¹¥¸ ‰ÍÕ‰µ¥ÑÑ•‘}‰äˆ°™½±±½Ý¥¹%‘Ì¤4(€€€€€€€€¹•Ä ‰ÍÑ…ÑÕÌˆ°€‰…ÁÁÉ½Ù•ˆ¤4(€€€€€€€€¹¹½Ð ‰…Ñ•½Éå}¥ˆ°€‰¥Ìˆ°¹Õ±°¤4(€€€€€€€€¹½É‘•È ‰É•…Ñ•‘}…Ðˆ°ì…Í•¹‘¥¹œè™…±Í”ô¤4(€€€€€€€€¹±¥µ¥Ð ÈÀ¤°4(€€€t¤ì4(€€€½¹ÍÐÉ…Ü€ôl4(€€€€€€¸¸¸ ¡ÑÉ¥•ÍI•Ì¹‘…Ñ„€üümt¤…Ì…¹åmt¤¹µ…À ¡È¤€ôø€¡ìÑåÁ”è€‰ÑÉ¥•ˆ°ÕÍ•É}¥èÈ¹ÕÍ•É}¥°É•…Ñ•‘}…ÐèÈ¹É•…Ñ•‘}…Ð°‘¥Í èÈ¹‘¥Í ô¤¤°4(€€€€€€¸¸¸ ¡‘¥Í¡•ÍI•Ì¹‘…Ñ„€üümt¤…Ì…¹åmt¤¹µ…À ¡¤€ôø€¡ìÑåÁ”è€‰Á½ÍÑ•ˆ°ÕÍ•É}¥è¹ÍÕ‰µ¥ÑÑ•‘}‰ä°É•…Ñ•‘}…Ðè¹É•…Ñ•‘}…Ð°‘¥Í èô¤¤°4(€€€t¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹‘¥Í ü¹¥¤ì4(€€€½¹ÍÐì‘…Ñ„èÁÉ½™¥±•Ìô€ô…Ý…¥Ð€¡ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€¹™É½´ ‰ÁÉ½™¥±•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°‘¥ÍÁ±…å}¹…µ”°ÕÍ•É¹…µ”°…Ù…Ñ…É}ÕÉ°°ÑÉ¥•‘}ÁÕ‰±¥Œˆ¤4(€€€€€€¹¥¸ ‰¥ˆ°™½±±½Ý¥¹%‘Ì¤ì4(€€€½¹ÍÐ‰å%€ô¹•Ü5…À ¡ÁÉ½™¥±•Ì€üümt¤¹µ…À ¡Àè…¹ä¤€ôømÀ¹¥°Át¤¤ì4(€€€É•ÑÕÉ¸É…Ü4(€€€€€€¹µ…À ¡¥Ñ•´¤€ôø€¡ì€¸¸¹¥Ñ•´°ÁÉ½™¥±”è‰å%¹•Ð¡¥Ñ•´¹ÕÍ•É}¥¤€üü¹Õ±°ô¤¤4(€€€€€€¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹ÑåÁ”€„ôô€‰ÑÉ¥•ˆñð€¡¥Ñ•´¹ÁÉ½™¥±”…Ì…¹ä¤ü¹ÑÉ¥•‘}ÁÕ‰±¥Œ€„ôô™…±Í”¤4(€€€€€€¹Í½ÉÐ ¡„°ˆ¤€ôø¹•Ü…Ñ”¡ˆ¹É•…Ñ•‘}…Ð¤¹•ÑQ¥µ” ¤€´¹•Ü…Ñ”¡„¹É•…Ñ•‘}…Ð¤¹•ÑQ¥µ” ¤¤4(€€€€€€¹Í±¥” À°€ÈÀ¤ì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐµåQÉ¥•‘%‘Ì€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰Pˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì½¹Ñ•áÐô¤€ôøì4(€€€½¹ÍÐì‘…Ñ„ô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰‘¥Í¡}ÑÉ¥•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰‘¥Í¡}¥ˆ¤4(€€€€€€¹•Ä ‰ÕÍ•É}¥ˆ°½¹Ñ•áÐ¹ÕÍ•É%¤ì4(€€€É•ÑÕÉ¸€¡‘…Ñ„€üümt¤¹µ…À ¡È¤€ôøÈ¹‘¥Í¡}¥¤ì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÍÕ‰µ¥Ñ½µÁ…É¥Í½¸€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èì‘¥Í¡%èÍÑÉ¥¹œì‘¥Í¡	%èÍÑÉ¥¹œìÝ¥¹¹•É%èÍÑÉ¥¹œô¤€ôø4(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€‘¥Í¡%èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤°4(€€€€€€€‘¥Í¡	%èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤°4(€€€€€€€Ý¥¹¹•É%èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤°4(€€€€€ô¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€¥˜€¡‘…Ñ„¹‘¥Í¡%€ôôô‘…Ñ„¹‘¥Í¡	%¤Ñ¡É½Ü¹•ÜÉÉ½È ‰¡½½Í”ÑÝ¼‘¥™™•É•¹Ð‘¥Í¡•Ìˆ¤ì4(€€€¥˜€¡‘…Ñ„¹Ý¥¹¹•É%€„ôô‘…Ñ„¹‘¥Í¡%€˜˜‘…Ñ„¹Ý¥¹¹•É%€„ôô‘…Ñ„¹‘¥Í¡	%¤4(€€€€€Ñ¡É½Ü¹•ÜÉÉ½È ‰]¥¹¹•ÈµÕÍÐ‰”½¹”½˜Ñ¡”ÑÝ¼‘¥Í¡•Ìˆ¤ì4(€€€€¼¼ÍÕ‰µ¥Ñ½µÁ…É¥Í½¸¥ÌÑ¡”…ÁÀÝÉ¥Ñ”…Ñ”™½È½µÁ…É¥Í½¹Ì¸Q¡”‘…Ñ…‰…Í”…±Í¼4(€€€€¼¼¡…Ì½µÁ…É¥Í½¹Í}É…¹­¥¹}­•å}Õ…ÉÍ¼™ÕÑÕÉ”ÝÉ¥Ñ•Ì…¹¹½Ð‰åÁ…ÍÌÑ¡¥ÌÉÕ±”¸4(€€€½¹ÍÐì‘…Ñ„è‘¥Í¡•Ì°•ÉÉ½Èè‘”ô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰‘¥Í¡•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°…Ñ•½Éå}¥°ÍÕ‰ÑåÁ•}¥°ÍÑ…ÑÕÌˆ¤4(€€€€€€¹¥¸ ‰¥ˆ°m‘…Ñ„¹‘¥Í¡%°‘…Ñ„¹‘¥Í¡	%‘t¤ì4(€€€¥˜€¡‘”¤Ñ¡É½Ü¹•ÜÉÉ½È¡‘”¹µ•ÍÍ…”¤ì4(€€€¥˜€ …‘¥Í¡•Ìñð‘¥Í¡•Ì¹±•¹Ñ €„ôô€È¤Ñ¡É½Ü¹•ÜÉÉ½È ‰¥Í¡•Ì¹½Ð™½Õ¹ˆ¤ì4(€€€¥˜€¡‘¥Í¡•ÍlÁt¹…Ñ•½Éå}¥€„ôô‘¥Í¡•ÍlÅt¹…Ñ•½Éå}¥¤4(€€€€€Ñ¡É½Ü¹•ÜÉÉ½È ‰¥Í¡•ÌµÕÍÐ‰”¥¸Ñ¡”Í…µ”…Ñ•½Éäˆ¤ì4(€€€¥˜€¡‘¥Í¡•Ì¹Í½µ” ¡¤€ôø¹ÍÑ…ÑÕÌ€„ôô€‰…ÁÁÉ½Ù•ˆ¤¤4(€€€€€Ñ¡É½Ü¹•ÜÉÉ½È ‰¥Í ¹½Ð…Ù…¥±…‰±”™½È½µÁ…É¥Í½¸ˆ¤ì4(€€€€¼¼QÉ¥•µ‰•™½É”µ½µÁ…É¥¹œè…±Í¼Ù…±¥‘…Ñ•…ÐÑ¡”±…å•È‰äÑÉ}½µÁ…É¥Í½¹Í}ÑÉ¥•¸4(€€€½¹ÍÐì‘…Ñ„èÑÉ¥•°•ÉÉ½ÈèÑ”ô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰‘¥Í¡}ÑÉ¥•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰‘¥Í¡}¥ˆ¤4(€€€€€€¹•Ä ‰ÕÍ•É}¥ˆ°½¹Ñ•áÐ¹ÕÍ•É%¤4(€€€€€€¹¥¸ ‰‘¥Í¡}¥ˆ°m‘…Ñ„¹‘¥Í¡%°‘…Ñ„¹‘¥Í¡	%‘t¤ì4(€€€¥˜€¡Ñ”¤Ñ¡É½Ü¹•ÜÉÉ½È¡Ñ”¹µ•ÍÍ…”¤ì4(€€€¥˜€ ¡ÑÉ¥•€üümt¤¹±•¹Ñ €ð€È¤ì4(€€€€€Ñ¡É½Ü¹•ÜÉÉ½È ‰5…É¬‰½Ñ ‘¥Í¡•Ì…ÌÑÉ¥•‰•™½É”½µÁ…É¥¹œÑ¡•´¸ˆ¤ì4(€€€ô4(€€€½¹ÍÐì‘…Ñ„è…ÑI½Ü°•ÉÉ½Èè…ÑÉÈô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰…Ñ•½É¥•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°É•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”ˆ¤4(€€€€€€¹•Ä ‰¥ˆ°‘¥Í¡•ÍlÁt¹…Ñ•½Éå}¥„¤4(€€€€€€¹µ…å‰•M¥¹±” ¤ì4(€€€¥˜€¡…ÑÉÈ¤Ñ¡É½Ü¹•ÜÉÉ½È¡…ÑÉÈ¹µ•ÍÍ…”¤ì4(€€€½¹ÍÐì‘…Ñ„èÍÕ‰ÑåÁ•Ì°•ÉÉ½ÈèÍ”ô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰‘¥Í¡}ÍÕ‰ÑåÁ•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°…Ñ•½Éå}¥°¥Í}…Ñ¥Ù”ˆ¤4(€€€€€€¹•Ä ‰…Ñ•½Éå}¥ˆ°‘¥Í¡•ÍlÁt¹…Ñ•½Éå}¥„¤ì4(€€€¥˜€¡Í”¤Ñ¡É½Ü¹•ÜÉÉ½È¡Í”¹µ•ÍÍ…”¤ì4(€€€½¹ÍÐ…Ñ¥Ù•MÕ‰ÑåÁ•Ì€ô€¡ÍÕ‰ÑåÁ•Ì€üümt¤¹™¥±Ñ•È ¡Ìè…¹ä¤€ôøÌ¹¥Í}…Ñ¥Ù”¤ì4(€€€½¹ÍÐÍ½Á•€ô	½½±•…¸ ¡…ÑI½Ü…Ì…¹ä¤ü¹É•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”¤ñð…Ñ¥Ù•MÕ‰ÑåÁ•Ì¹±•¹Ñ €ø€Àì4(€€€¥˜€¡Í½Á•¤ì4(€€€€€¥˜€ …‘¥Í¡•ÍlÁt¹ÍÕ‰ÑåÁ•}¥ñð€…‘¥Í¡•ÍlÅt¹ÍÕ‰ÑåÁ•}¥¤4(€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È ‰	½Ñ ‘¥Í¡•ÌµÕÍÐ¡…Ù”„‘¥Í ÑåÁ”ˆ¤ì4(€€€€€¥˜€¡‘¥Í¡•ÍlÁt¹ÍÕ‰ÑåÁ•}¥€„ôô‘¥Í¡•ÍlÅt¹ÍÕ‰ÑåÁ•}¥¤4(€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È ‰¥Í¡•ÌµÕÍÐ‰”Ñ¡”Í…µ”‘¥Í ÑåÁ”ˆ¤ì4(€€€€€½¹ÍÐµ…Ñ €ô…Ñ¥Ù•MÕ‰ÑåÁ•Ì¹™¥¹ ¡Ìè…¹ä¤€ôøÌ¹¥€ôôô‘¥Í¡•ÍlÁt¹ÍÕ‰ÑåÁ•}¥¤ì4(€€€€€¥˜€ …µ…Ñ ¤Ñ¡É½Ü¹•ÜÉÉ½È ‰¥Í ÑåÁ”¥Ì¥¹…Ñ¥Ù”½È‰•±½¹ÌÑ¼…¹½Ñ¡•È…Ñ•½Éäˆ¤ì4(€€€ô•±Í”¥˜€¡‘¥Í¡•ÍlÁt¹ÍÕ‰ÑåÁ•}¥ñð‘¥Í¡•ÍlÅt¹ÍÕ‰ÑåÁ•}¥¤ì4(€€€€€Ñ¡É½Ü¹•ÜÉÉ½È ‰¥Í ÑåÁ”¥Ì¹½ÐÙ…±¥™½ÈÑ¡¥Ì…Ñ•½Éäˆ¤ì4(€€€ô4(€€€½¹ÍÐ±¼€ô‘…Ñ„¹‘¥Í¡%€ð‘…Ñ„¹‘¥Í¡	%€ü‘…Ñ„¹‘¥Í¡%€è‘…Ñ„¹‘¥Í¡	%ì4(€€€½¹ÍÐ¡¤€ô‘…Ñ„¹‘¥Í¡%€ð‘…Ñ„¹‘¥Í¡	%€ü‘…Ñ„¹‘¥Í¡	%€è‘…Ñ„¹‘¥Í¡%ì4(4(€€€€¼¼Q¡”Í•ÉÙ¥”µÉ½±”µ½¹±äIA¥¹Í•ÉÑÌÑ¡”¥µµÕÑ…‰±”½µÁ…É¥Í½¸¸‘…Ñ…‰…Í”(€€€€¼¼ÑÉ¥•È…ÁÁ±¥•Ì±¼…¹½Õ¹ÐÕÁ‘…Ñ•Ì¥¸Ñ¡”Í…µ”ÑÉ…¹Í…Ñ¥½¸¸(€€€½¹ÍÐìÍÕÁ…‰…Í•‘µ¥¸ô€ô…Ý…¥Ð¥µÁ½ÉÐ ‰ ½¥¹Ñ•É…Ñ¥½¹Ì½ÍÕÁ…‰…Í”½±¥•¹Ð¹Í•ÉÙ•Èˆ¤ì(€€€½¹ÍÐì‘…Ñ„è½µÁ…É¥Í½¹%°•ÉÉ½Èô€ô…Ý…¥ÐÍÕÁ…‰…Í•‘µ¥¸¹ÉÁŒ ‰ÍÕ‰µ¥Ñ}½µÁ…É¥Í½¹}…Ñ½µ¥Œˆ°ì(€€€€€}ÕÍ•É}¥è½¹Ñ•áÐ¹ÕÍ•É%°(€€€€€}‘¥Í¡}…}¥è±¼°(€€€€€}‘¥Í¡}‰}¥è¡¤°(€€€€€}Ý¥¹¹•É}¥è‘…Ñ„¹Ý¥¹¹•É%°(€€€ô¤ì(€€€¥˜€¡•ÉÉ½È¤ì(€€€€€¥˜€¡•ÉÉ½È¹½‘”€ôôô€ˆÈÌÔÀÔˆñð•ÉÉ½È¹µ•ÍÍ…”¹¥¹±Õ‘•Ì ‰…±É•…‘ä½µÁ…É•ˆ¤¤ì(€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È ‰e½Ô¡…Ù”…±É•…‘ä½µÁ…É•Ñ¡•Í”ÑÝ¼‘¥Í¡•Ì¸ˆ¤ì(€€€€€ô(€€€€€Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì(€€€ô(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”°½µÁ…É¥Í½¹%ôì(€ô¤ì(4)•áÁ½ÉÐ½¹ÍÐµåAÉ½™¥±”€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰Pˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì½¹Ñ•áÐô¤€ôøì4(€€€½¹ÍÐmÑÉ¥•°½µÁ…É•°ÁÉ½™¥±”°Á½ÍÑ•°™½±±½Ý•ÉÌ°™½±±½Ý¥¹t€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l4(€€€€€½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€€€¹™É½´ ‰‘¥Í¡}ÑÉ¥•Ìˆ¤4(€€€€€€€€¹Í•±•Ð¡‘¥Í¡}¥°É•…Ñ•‘}…Ð°‘¥Í é‘¥Í¡•Ì ‘í‘¥Í¡M•±•Ñô¥€¤4(€€€€€€€€¹•Ä ‰ÕÍ•É}¥ˆ°½¹Ñ•áÐ¹ÕÍ•É%¤4(€€€€€€€€¹½É‘•È ‰É•…Ñ•‘}…Ðˆ°ì…Í•¹‘¥¹œè™…±Í”ô¤°4(€€€€€½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€€€¹™É½´ ‰½µÁ…É¥Í½¹Ìˆ¤4(€€€€€€€€¹Í•±•Ð 4(€€€€€€€€€¥°Ý¥¹¹•É}¥°ÕÁ‘…Ñ•‘}…Ð°4(€€€€€€€±¼é‘¥Í¡•Ì…½µÁ…É¥Í½¹Í}‘¥Í¡}±½}¥‘}™­•ä¡¥°¹…µ•}•¸°Á±…”éÁ±…•Ì¡¹…µ”¤¤°4(€€€€€€€¡¤é‘¥Í¡•Ì…½µÁ…É¥Í½¹Í}‘¥Í¡}¡¥}¥‘}™­•ä¡¥°¹…µ•}•¸°Á±…”éÁ±…•Ì¡¹…µ”¤¥€°4(€€€€€€€€¤4(€€€€€€€€¹•Ä ‰ÕÍ•É}¥ˆ°½¹Ñ•áÐ¹ÕÍ•É%¤4(€€€€€€€€¹½É‘•È ‰ÕÁ‘…Ñ•‘}…Ðˆ°ì…Í•¹‘¥¹œè™…±Í”ô¤°4(€€€€€€¡½¹Ñ•áÐ¹ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€€€¹™É½´ ‰ÁÉ½™¥±•Ìˆ¤4(€€€€€€€€¹Í•±•Ð ‰¥°‘¥ÍÁ±…å}¹…µ”°ÕÍ•É¹…µ”°…Ù…Ñ…É}ÕÉ°°‰¥¼°ÑÉ¥•‘}ÁÕ‰±¥Œˆ¤4(€€€€€€€€¹•Ä ‰¥ˆ°½¹Ñ•áÐ¹ÕÍ•É%¤4(€€€€€€€€¹µ…å‰•M¥¹±” ¤°4(€€€€€½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€€€¹™É½´ ‰‘¥Í¡•Ìˆ¤4(€€€€€€€€¹Í•±•Ð¡‘¥Í¡M•±•Ð¤4(€€€€€€€€¹•Ä ‰ÍÕ‰µ¥ÑÑ•‘}‰äˆ°½¹Ñ•áÐ¹ÕÍ•É%¤4(€€€€€€€€¹½É‘•È ‰É•…Ñ•‘}…Ðˆ°ì…Í•¹‘¥¹œè™…±Í”ô¤°4(€€€€€€¡½¹Ñ•áÐ¹ÍÕÁ…‰…Í”…Ì…¹ä¤¹™É½´ ‰™½±±½ÝÌˆ¤¹Í•±•Ð ‰™½±±½Ý•É}¥ˆ¤¹•Ä ‰™½±±½Ý¥¹}¥ˆ°½¹Ñ•áÐ¹ÕÍ•É%¤°4(€€€€€€¡½¹Ñ•áÐ¹ÍÕÁ…‰…Í”…Ì…¹ä¤¹™É½´ ‰™½±±½ÝÌˆ¤¹Í•±•Ð ‰™½±±½Ý¥¹}¥ˆ¤¹•Ä ‰™½±±½Ý•É}¥ˆ°½¹Ñ•áÐ¹ÕÍ•É%¤°4(€€€t¤ì4(€€€É•ÑÕÉ¸ì4(€€€€€ÁÉ½™¥±”èÁÉ½™¥±”¹‘…Ñ„€üü¹Õ±°°4(€€€€€ÑÉ¥•èÑÉ¥•¹‘…Ñ„€üümt°4(€€€€€½µÁ…É•è½µÁ…É•¹‘…Ñ„€üümt°4(€€€€€Á½ÍÑ•èÁ½ÍÑ•¹‘…Ñ„€üümt°4(€€€€€™½±±½Ý•ÉÍ}½Õ¹Ðè™½±±½Ý•ÉÌ¹‘…Ñ„ü¹±•¹Ñ €üü€À°4(€€€€€™½±±½Ý¥¹}½Õ¹Ðè™½±±½Ý¥¹œ¹‘…Ñ„ü¹±•¹Ñ €üü€À°4(€€€ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÕÁ‘…Ñ•5åAÉ½™¥±”€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èìÕÍ•É¹…µ”üèÍÑÉ¥¹œì‘¥ÍÁ±…å9…µ”üèÍÑÉ¥¹œì…Ù…Ñ…ÉUÉ°üèÍÑÉ¥¹œì‰¥¼üèÍÑÉ¥¹œìÑÉ¥•‘AÕ‰±¥Œüè‰½½±•…¸ô¤€ôø4(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€ÕÍ•É¹…µ”èè4(€€€€€€€€€€¹ÍÑÉ¥¹œ ¤4(€€€€€€€€€€¹ÑÉ¥´ ¤4(€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤4(€€€€€€€€€€¹É••à ½ym„µèÀ´å}uìÌ°ÈÑô¼°€‰UÍ”€Ì´ÈÐ±½Ý•É…Í”±•ÑÑ•ÉÌ°¹Õµ‰•ÉÌ°½ÈÕ¹‘•ÉÍ½É•Ì¸ˆ¤4(€€€€€€€€€€¹½ÁÑ¥½¹…° ¤°4(€€€€€€€‘¥ÍÁ±…å9…µ”èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ…à àÀ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€…Ù…Ñ…ÉUÉ°èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹ÕÉ° ¤¹µ…à ÔÀÀ¤¹½È¡è¹±¥Ñ•É…° ˆˆ¤¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€‰¥¼èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ…à ÄØÀ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€ÑÉ¥•‘AÕ‰±¥Œèè¹‰½½±•…¸ ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€ô¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€½¹ÍÐÁ…Ñ èI•½ÉñÍÑÉ¥¹œ°Õ¹­¹½Ý¸ø€ôíôì4(€€€¥˜€¡‘…Ñ„¹ÕÍ•É¹…µ”€„ôôÕ¹‘•™¥¹•¤Á…Ñ ¹ÕÍ•É¹…µ”€ô‘…Ñ„¹ÕÍ•É¹…µ”ì4(€€€¥˜€¡‘…Ñ„¹‘¥ÍÁ±…å9…µ”€„ôôÕ¹‘•™¥¹•¤Á…Ñ ¹‘¥ÍÁ±…å}¹…µ”€ô‘…Ñ„¹‘¥ÍÁ±…å9…µ”ñð¹Õ±°ì4(€€€¥˜€¡‘…Ñ„¹…Ù…Ñ…ÉUÉ°€„ôôÕ¹‘•™¥¹•¤Á…Ñ ¹…Ù…Ñ…É}ÕÉ°€ô‘…Ñ„¹…Ù…Ñ…ÉUÉ°ñð¹Õ±°ì4(€€€¥˜€¡‘…Ñ„¹‰¥¼€„ôôÕ¹‘•™¥¹•¤Á…Ñ ¹‰¥¼€ô‘…Ñ„¹‰¥¼ñð¹Õ±°ì4(€€€¥˜€¡‘…Ñ„¹ÑÉ¥•‘AÕ‰±¥Œ€„ôôÕ¹‘•™¥¹•¤Á…Ñ ¹ÑÉ¥•‘}ÁÕ‰±¥Œ€ô‘…Ñ„¹ÑÉ¥•‘AÕ‰±¥Œì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð€¡½¹Ñ•áÐ¹ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€¹™É½´ ‰ÁÉ½™¥±•Ìˆ¤4(€€€€€€¹ÕÁÍ•ÉÐ¡ì¥è½¹Ñ•áÐ¹ÕÍ•É%°€¸¸¹Á…Ñ ô°ì½¹½¹™±¥Ðè€‰¥ˆô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÁÕ‰±¥AÉ½™¥±”€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰Pˆô¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èìÕÍ•É¹…µ”èÍÑÉ¥¹œô¤€ôø4(€€€è¹½‰©•Ð¡ìÕÍ•É¹…µ”èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤¹É••à ½ym„µèÀ´å}uìÌ°ÈÑô¼¤ô¤¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„ô¤€ôøì4(€€€½¹ÍÐÍÕÁ…‰…Í”€ôÁÕ‰±¥±¥•¹Ð ¤ì4(€€€½¹ÍÐì‘…Ñ„èÁÉ½™¥±”°•ÉÉ½Èô€ô…Ý…¥Ð€¡ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€¹™É½´ ‰ÁÉ½™¥±•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°‘¥ÍÁ±…å}¹…µ”°ÕÍ•É¹…µ”°…Ù…Ñ…É}ÕÉ°°‰¥¼°ÑÉ¥•‘}ÁÕ‰±¥Œˆ¤4(€€€€€€¹¥±¥­” ‰ÕÍ•É¹…µ”ˆ°‘…Ñ„¹ÕÍ•É¹…µ”¤4(€€€€€€¹µ…å‰•M¥¹±” ¤ì4(€€€¥˜€¡•ÉÉ½Èñð€…ÁÉ½™¥±”ü¹ÕÍ•É¹…µ”¤É•ÑÕÉ¸¹Õ±°ì4(€€€½¹ÍÐìÍÕÁ…‰…Í•‘µ¥¸ô€ô…Ý…¥Ð¥µÁ½ÉÐ ‰ ½¥¹Ñ•É…Ñ¥½¹Ì½ÍÕÁ…‰…Í”½±¥•¹Ð¹Í•ÉÙ•Èˆ¤ì4(€€€½¹ÍÐmÑÉ¥•°½µÁ…É•°½Õ¹ÑÍt€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l4(€€€€€ÁÉ½™¥±”¹ÑÉ¥•‘}ÁÕ‰±¥Œ4(€€€€€€€€ü€¡ÍÕÁ…‰…Í•‘µ¥¸…Ì…¹ä¤4(€€€€€€€€€€€€¹™É½´ ‰‘¥Í¡}ÑÉ¥•Ìˆ¤4(€€€€€€€€€€€€¹Í•±•Ð¡‘¥Í¡}¥°É•…Ñ•‘}…Ð°‘¥Í é‘¥Í¡•Ì ‘í‘¥Í¡M•±•Ñô¥€¤(€€€€€€€€€€€€¹•Ä ‰ÕÍ•É}¥ˆ°ÁÉ½™¥±”¹¥¤(€€€€€€€€€€€€¹•Ä ‰‘¥Í ¹ÍÑ…ÑÕÌˆ°€‰…ÁÁÉ½Ù•ˆ¤(€€€€€€€€€€€€¹½É‘•È ‰É•…Ñ•‘}…Ðˆ°ì…Í•¹‘¥¹œè™…±Í”ô¤4(€€€€€€€€€€€€¹±¥µ¥Ð ÈÐ¤4(€€€€€€€€èAÉ½µ¥Í”¹É•Í½±Ù”¡ì‘…Ñ„èmtô¤°4(€€€€€€¡ÍÕÁ…‰…Í•‘µ¥¸…Ì…¹ä¤¹™É½´ ‰½µÁ…É¥Í½¹Ìˆ¤¹Í•±•Ð ‰¥ˆ¤¹•Ä ‰ÕÍ•É}¥ˆ°ÁÉ½™¥±”¹¥¤°4(€€€€€€¡ÍÕÁ…‰…Í•‘µ¥¸…Ì…¹ä¤¹ÉÁŒ ‰•Ñ}™½±±½Ý}½Õ¹ÑÌˆ°ì}ÕÍ•É}¥èÁÉ½™¥±”¹¥ô¤¹µ…å‰•M¥¹±” ¤°4(€€€t¤ì4(€€€É•ÑÕÉ¸ì4(€€€€€ÁÉ½™¥±”°4(€€€€€ÑÉ¥•èÑÉ¥•¹‘…Ñ„€üümt°4(€€€€€½µÁ…É¥Í½¹Í}½Õ¹Ðè½µÁ…É•¹‘…Ñ„ü¹±•¹Ñ €üü€À°4(€€€€€™½±±½Ý•ÉÍ}½Õ¹Ðè9Õµ‰•È ¡½Õ¹ÑÌ…Ì…¹ä¤ü¹‘…Ñ„ü¹™½±±½Ý•ÉÍ}½Õ¹Ð€üü€À¤°4(€€€€€™½±±½Ý¥¹}½Õ¹Ðè9Õµ‰•È ¡½Õ¹ÑÌ…Ì…¹ä¤ü¹‘…Ñ„ü¹™½±±½Ý¥¹}½Õ¹Ð€üü€À¤°4(€€€ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÍÕ‰µ¥ÑI•Á½ÉÐ€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èì‘¥Í¡%èÍÑÉ¥¹œìÉ•…Í½¸èÍÑÉ¥¹œì¹½Ñ”üèÍÑÉ¥¹œô¤€ôø4(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€‘¥Í¡%èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤°4(€€€€€€€É•…Í½¸èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ØÀ¤°4(€€€€€€€¹½Ñ”èè¹ÍÑÉ¥¹œ ¤¹µ…à ÔÀÀ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€ô¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”¹™É½´ ‰É•Á½ÉÑÌˆ¤¹¥¹Í•ÉÐ¡ì4(€€€€€‘¥Í¡}¥è‘…Ñ„¹‘¥Í¡%°4(€€€€€ÕÍ•É}¥è½¹Ñ•áÐ¹ÕÍ•É%°4(€€€€€É•…Í½¸è‘…Ñ„¹É•…Í½¸°4(€€€€€¹½Ñ”è‘…Ñ„¹¹½Ñ”°4(€€€ô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐ±•…‘•É‰½…É€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰Pˆô¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èì…Ñ•½ÉåM±ÕœèÍÑÉ¥¹œìÍÕ‰ÑåÁ•M±ÕœüèÍÑÉ¥¹œì…É•…M±ÕœüèÍÑÉ¥¹œìµ¥¹¥µÕµ½µÁ…É¥Í½¹Ìüè¹Õµ‰•Èô¤€ôø4(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€…Ñ•½ÉåM±Õœèè¹ÍÑÉ¥¹œ ¤°4(€€€€€€€ÍÕ‰ÑåÁ•M±Õœèè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€…É•…M±Õœèè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€µ¥¹¥µÕµ½µÁ…É¥Í½¹Ìèè¹¹Õµ‰•È ¤¹µ¥¸ À¤¹µ…à ÄÀÀ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€ô¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„ô¤€ôøì4(€€€½¹ÍÐÍÕÁ…‰…Í”€ôÁÕ‰±¥±¥•¹Ð ¤ì4(€€€½¹ÍÐm…ÑI•Ì°…É•…I•Ít€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l4(€€€€€ÍÕÁ…‰…Í”¹™É½´ ‰…Ñ•½É¥•Ìˆ¤¹Í•±•Ð ‰¥°É•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”ˆ¤¹•Ä ‰Í±Õœˆ°‘…Ñ„¹…Ñ•½ÉåM±Õœ¤¹µ…å‰•M¥¹±” ¤°4(€€€€€‘…Ñ„¹…É•…M±Õœ4(€€€€€€€€üÍÕÁ…‰…Í”¹™É½´ ‰…É•…Ìˆ¤¹Í•±•Ð ‰¥ˆ¤¹•Ä ‰Í±Õœˆ°‘…Ñ„¹…É•…M±Õœ¤¹µ…å‰•M¥¹±” ¤4(€€€€€€€€èAÉ½µ¥Í”¹É•Í½±Ù”¡ì‘…Ñ„è¹Õ±°°•ÉÉ½Èè¹Õ±°ô…Ì…¹ä¤°4(€€€t¤ì4(€€€¥˜€ ……ÑI•Ì¹‘…Ñ„¤É•ÑÕÉ¸mtì4(€€€¥˜€¡‘…Ñ„¹…É•…M±Õœ€˜˜€……É•…I•Ì¹‘…Ñ„¤É•ÑÕÉ¸mtì4(€€€½¹ÍÐì‘…Ñ„è…Ñ¥Ù•MÕ‰ÑåÁ•Ì°•ÉÉ½ÈèÍÕ‰ÉÈô€ô…Ý…¥ÐÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰‘¥Í¡}ÍÕ‰ÑåÁ•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°Í±Õœˆ¤4(€€€€€€¹•Ä ‰…Ñ•½Éå}¥ˆ°…ÑI•Ì¹‘…Ñ„¹¥¤4(€€€€€€¹•Ä ‰¥Í}…Ñ¥Ù”ˆ°ÑÉÕ”¤ì4(€€€¥˜€¡ÍÕ‰ÉÈ¤Ñ¡É½Ü¹•ÜÉÉ½È¡ÍÕ‰ÉÈ¹µ•ÍÍ…”¤ì4(€€€½¹ÍÐÍ½Á•€ô	½½±•…¸ ¡…ÑI•Ì¹‘…Ñ„…Ì…¹ä¤¹É•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”¤ñð€¡…Ñ¥Ù•MÕ‰ÑåÁ•Ì€üümt¤¹±•¹Ñ €ø€Àì4(€€€½¹ÍÐÍÕ‰ÑåÁ”€ô‘…Ñ„¹ÍÕ‰ÑåÁ•M±Õœ4(€€€€€€ü€¡…Ñ¥Ù•MÕ‰ÑåÁ•Ì€üümt¤¹™¥¹ ¡Ìè…¹ä¤€ôøÌ¹Í±Õœ€ôôô‘…Ñ„¹ÍÕ‰ÑåÁ•M±Õœ¤4(€€€€€€è¹Õ±°ì4(€€€¥˜€¡Í½Á•€˜˜€…ÍÕ‰ÑåÁ”¤É•ÑÕÉ¸mtì4(€€€¥˜€ …Í½Á•€˜˜‘…Ñ„¹ÍÕ‰ÑåÁ•M±Õœ¤É•ÑÕÉ¸mtì4(€€€±•ÐÄ€ô‘…Ñ„¹…É•…M±Õœ4(€€€€€€üÍÕÁ…‰…Í”¹™É½´ ‰‘¥Í¡•Ìˆ¤¹Í•±•Ð¡‘¥Í¡M•±•Ñ%¹¹•È¤4(€€€€€€èÍÕÁ…‰…Í”¹™É½´ ‰‘¥Í¡•Ìˆ¤¹Í•±•Ð¡‘¥Í¡M•±•Ð¤ì4(€€€Ä€ôÄ4(€€€€€€¹•Ä ‰ÍÑ…ÑÕÌˆ°€‰…ÁÁÉ½Ù•ˆ¤4(€€€€€€¹¹½Ð ‰…Ñ•½Éå}¥ˆ°€‰¥Ìˆ°¹Õ±°¤4(€€€€€€¹•Ä ‰…Ñ•½Éå}¥ˆ°…ÑI•Ì¹‘…Ñ„¹¥¤4(€€€€€€¹Ñ” (€€€€€€€€‰½µÁ…É¥Í½¹Í}½Õ¹Ðˆ°(€€€€€€€5…Ñ ¹µ…à¡AU	1%}I9-}Q!IM!=1°‘…Ñ„¹µ¥¹¥µÕµ½µÁ…É¥Í½¹Ì€üüAU	1%}I9-}Q!IM!=1¤°(€€€€€€¤(€€€€€€¹½É‘•È ‰•±¼ˆ°ì…Í•¹‘¥¹œè™…±Í”ô¤4(€€€€€€¹±¥µ¥Ð ÔÀ¤ì4(€€€¥˜€¡Í½Á•¤Ä€ôÄ¹•Ä ‰ÍÕ‰ÑåÁ•}¥ˆ°ÍÕ‰ÑåÁ”„¹¥¤ì4(€€€•±Í”Ä€ôÄ¹¥Ì ‰ÍÕ‰ÑåÁ•}¥ˆ°¹Õ±°¤ì4(€€€¥˜€¡…É•…I•Ì¹‘…Ñ„¤Ä€ôÄ¹•Ä ‰Á±…”¹…É•…}¥ˆ°…É•…I•Ì¹‘…Ñ„¹¥¤ì4(€€€½¹ÍÐì‘…Ñ„èÉ½ÝÌ°•ÉÉ½Èô€ô…Ý…¥ÐÄì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸Ý¥Ñ¡QÉ¥•‘½Õ¹ÑÌ¡ÍÕÁ…‰…Í”°É½ÝÌ€üümt¤ì4(€ô¤ì4