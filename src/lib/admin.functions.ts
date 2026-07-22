import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!data };
  });

export const listPending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("dishes")
      .select(
        `id, name_en, name_th, price_thb, photo_url, note, status, created_at, category_id, subtype_id, requested_category_en, requested_category_th,
        category:categories(name_en, slug), subtype:dish_subtypes(name_en, slug), place:places(name, area:areas(name_en))`,
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listDishesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { query?: string; missingPhotoOnly?: boolean }) =>
    z.object({ query: z.string().max(120).optional(), missingPhotoOnly: z.boolean().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    let q = context.supabase
      .from("dishes")
      .select(
        `id, name_en, name_th, price_thb, photo_url, note, status, created_at, comparisons_count,
        category:categories(name_en, slug), subtype:dish_subtypes(name_en, slug), place:places(name, area:areas(name_en))`,
      )
      .order("created_at", { ascending: false })
      .limit(80);
    if (data.missingPhotoOnly) q = q.is("photo_url", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const term = data.query?.trim().toLowerCase();
    if (!term) return rows ?? [];
    return (rows ?? []).filter((dish: any) =>
      [dish.name_en, dish.name_th, dish.place?.name, dish.category?.name_en, dish.category?.slug]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  });

export const moderateDish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; action: "approve" | "reject" | "needs_update" | "clear_update" }) =>
    z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject", "needs_update", "clear_update"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.action === "approve") {
      const { data: dish, error: checkError } = await context.supabase
        .from("dishes")
        .select("category_id")
        .eq("id", data.id)
        .maybeSingle();
      if (checkError) throw new Error(checkError.message);
      if (!dish?.category_id) throw new Error("Assign a category before approving this dish");
    }
    const patch =
      data.action === "approve"
        ? { status: "approved" as const }
        : data.action === "reject"
          ? { status: "rejected" as const }
          : data.action === "needs_update"
            ? { needs_update: true }
            : { needs_update: false };
    const { error } = await context.supabase.from("dishes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    // On approve, cascade to the linked place so anonymous visitors can
    // actually see the place row (places_select_approved hides pending places).
    if (data.action === "approve") {
      const { data: dish, error: de } = await context.supabase
        .from("dishes")
        .select("place_id")
        .eq("id", data.id)
        .maybeSingle();
      if (de) throw new Error(de.message);
      if (dish?.place_id) {
        const { error: pe } = await context.supabase
          .from("places")
          .update({ status: "approved" })
          .eq("id", dish.place_id)
          .neq("status", "approved");
        if (pe) throw new Error(pe.message);
      }
    }
    return { ok: true };
  });

export const assignDishCategoryAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { dishId: string; categoryId: string }) =>
    z.object({ dishId: z.string().uuid(), categoryId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("dishes")
      .update({
        category_id: data.categoryId,
        subtype_id: null,
        requested_category_en: null,
        requested_category_th: null,
      })
      .eq("id", data.dishId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createCategoryForDishAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { dishId: string; slug: string; name_en: string; name_th: string; cuisine?: string }) =>
    z
      .object({
        dishId: z.string().uuid(),
        slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
        name_en: z.string().min(1).max(80),
        name_th: z.string().min(1).max(80),
        cuisine: z.string().max(60).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: category, error: categoryError } = await context.supabase
      .from("categories")
      .insert({
        slug: data.slug,
        name_en: data.name_en,
        name_th: data.name_th,
        cuisine: data.cuisine || null,
      })
      .select("id")
      .single();
    if (categoryError) throw new Error(categoryError.message);
    const { error } = await context.supabase
      .from("dishes")
      .update({
        category_id: category.id,
        subtype_id: null,
        requested_category_en: null,
        requested_category_th: null,
      })
      .eq("id", data.dishId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const adminPhotoUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => {
    if (!v) return true;
    if (/^\/photos\/[A-Za-z0-9._~!$&'()*+,;=:@/-]+$/i.test(v)) return true;
    if (!/^https?:\/\//i.test(v)) return false;
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }, "Use a /photos/ path or an image URL.");

export const updateDishAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; photo_url?: string }) =>
    z.object({ id: z.string().uuid(), photo_url: adminPhotoUrlSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("dishes").update({ photo_url: data.photo_url }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDishAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("dishes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const mergeDishAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { keepId: string; removeId: string }) =>
    z.object({ keepId: z.string().uuid(), removeId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.keepId === data.removeId) throw new Error("Choose two different dishes");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dishes, error: dishError } = await supabaseAdmin
      .from("dishes")
      .select("id")
      .in("id", [data.keepId, data.removeId]);
    if (dishError) throw new Error(dishError.message);
    if (!dishes || dishes.length !== 2) throw new Error("Both dishes must exist");

    const { data: tries, error: triesError } = await supabaseAdmin
      .from("dish_tries")
      .select("user_id")
      .eq("dish_id", data.removeId);
    if (triesError) throw new Error(triesError.message);
    if ((tries ?? []).length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("dish_tries")
        .upsert(
          (tries ?? []).map((row: any) => ({ user_id: row.user_id, dish_id: data.keepId })),
          { onConflict: "user_id,dish_id", ignoreDuplicates: true },
        );
      if (upsertError) throw new Error(upsertError.message);
    }
    const { error: reportError } = await supabaseAdmin
      .from("reports")
      .update({ dish_id: data.keepId })
      .eq("dish_id", data.removeId);
    if (reportError) throw new Error(reportError.message);
    const { error: deleteError } = await supabaseAdmin.from("dishes").delete().eq("id", data.removeId);
    if (deleteError) throw new Error(deleteError.message);
    return { ok: true };
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("reports")
      .select(`id, reason, note, status, created_at, dish:dishes(id, name_en, place:places(name))`)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: "resolved" | "dismissed" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["resolved", "dismissed"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("reports").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PLACE_MATCH_THRESHOLD = 0.55;

type ImportIssue = { row: number; reason: string };

// CSV: category_slug,subtype_slug,area_slug,place_name,address,lat,lng,dish_name_en,dish_name_th,price_thb,photo_url,note
export const bulkImportCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { csv: string; autoApprove?: boolean }) =>
    z.object({ csv: z.string().min(1).max(500000), autoApprove: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const rows = parseCsvRows(data.csv);
    if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row");
    const header = rows[0].map((h, i) => cleanHeader(h, i));
    const idx = (k: string) => header.indexOf(k);
    const need = ["category_slug", "area_slug", "place_name", "dish_name_en"];
    for (const k of need) if (idx(k) < 0) throw new Error(`Missing column: ${k}`);

    const [{ data: cats }, { data: areas }, { data: subtypes }] = await Promise.all([
      context.supabase.from("categories").select("id, slug, subtypes:dish_subtypes(id, slug, is_active)"),
      context.supabase.from("areas").select("id, slug"),
      context.supabase.from("dish_subtypes").select("id, slug, category_id, is_active"),
    ]);
    const catMap = new Map((cats ?? []).map((c: any) => [c.slug, c]));
    const areaMap = new Map((areas ?? []).map((a: any) => [a.slug, a.id]));
    const subtypesByCategory = new Map<string, any[]>();
    for (const subtype of subtypes ?? []) {
      if (!subtype.is_active) continue;
      const list = subtypesByCategory.get(subtype.category_id) ?? [];
      list.push(subtype);
      subtypesByCategory.set(subtype.category_id, list);
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: ImportIssue[] = [];
    const skips: ImportIssue[] = [];
    for (let li = 1; li < rows.length; li++) {
      const row = rows[li];
      const get = (k: string) => (idx(k) >= 0 ? (row[idx(k)]?.trim() ?? "") : "");
      try {
        const cat = catMap.get(get("category_slug"));
        const areaId = areaMap.get(get("area_slug"));
        if (!cat) throw new Error(`Unknown category_slug: ${get("category_slug")}`);
        if (!areaId) throw new Error(`Unknown area_slug: ${get("area_slug")}`);
        const placeName = get("place_name");
        if (!placeName) throw new Error("place_name is required");
        const dishName = get("dish_name_en");
        if (!dishName) throw new Error("dish_name_en is required");

        const activeSubtypes = subtypesByCategory.get(cat.id) ?? [];
        const subtypeSlug = get("subtype_slug");
        const subtype = subtypeSlug ? activeSubtypes.find((s: any) => s.slug === subtypeSlug) : null;
        if (activeSubtypes.length > 0 && !subtypeSlug) throw new Error(`subtype_slug is required for ${get("category_slug")}`);
        if (subtypeSlug && !subtype) throw new Error(`Unknown subtype_slug for ${get("category_slug")}: ${subtypeSlug}`);

        const coords = parseOptionalCoords(get("lat"), get("lng"));
        const existingPlace = await findSimilarPlaceInArea(context.supabase, areaId, placeName);
        let place: any = null;
        if (existingPlace) {
          place = existingPlace;
          if (coords && existingPlace.lat == null && existingPlace.lng == null) {
            const { error: coordError } = await (context.supabase as any)
              .from("places")
              .update({ lat: coords.lat, lng: coords.lng })
              .eq("id", existingPlace.id)
              .is("lat", null)
              .is("lng", null);
            if (coordError) throw new Error(coordError.message);
          }
        }
        else {
          const { data: np, error: npe } = await context.supabase
            .from("places")
            .insert({
              name: placeName,
              area_id: areaId,
              address: get("address") || null,
              lat: coords?.lat ?? null,
              lng: coords?.lng ?? null,
              created_by: context.userId,
              status: data.autoApprove ? "approved" : "pending",
            })
            .select("id, name, status, lat, lng")
            .single();
          if (npe) throw new Error(npe.message);
          place = np;
        }
        if (data.autoApprove && place.status !== "approved") {
          const { error: approveError } = await context.supabase.from("places").update({ status: "approved" }).eq("id", place.id);
          if (approveError) throw new Error(approveError.message);
        }
        const { data: existingDish, error: dishCheckError } = await context.supabase
          .from("dishes")
          .select("id, name_en")
          .eq("place_id", place.id)
          .ilike("name_en", dishName)
          .limit(1)
          .maybeSingle();
        if (dishCheckError) throw new Error(dishCheckError.message);
        if (existingDish) {
          skipped++;
          skips.push({ row: li + 1, reason: `Skipped existing dish: ${existingDish.name_en}` });
          continue;
        }
        const priceStr = get("price_thb");
        const price = priceStr ? Number(priceStr) : undefined;
        if (priceStr && !Number.isFinite(price)) throw new Error(`Invalid price_thb: ${priceStr}`);
        const { error: die } = await context.supabase.from("dishes").insert({
          name_en: dishName,
          name_th: get("dish_name_th") || null,
          place_id: place.id,
          category_id: cat.id,
          subtype_id: subtype?.id ?? null,
          price_thb: price ?? null,
          photo_url: get("photo_url") || null,
          note: get("note") || null,
          status: data.autoApprove ? "approved" : "pending",
          submitted_by: context.userId,
        });
        if (die) throw new Error(die.message);
        created++;
      } catch (e: any) {
        failed++;
        errors.push({ row: li + 1, reason: e.message });
      }
    }
    return { created, skipped, failed, errors, skips };
  });

export const importPlacesCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { csv: string; autoApprove?: boolean }) =>
    z.object({ csv: z.string().min(1).max(500000), autoApprove: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const rows = parseCsvRows(data.csv);
    if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row");
    const header = rows[0].map((h, i) => cleanHeader(h, i));
    const idx = (k: string) => header.indexOf(k);
    for (const k of ["name", "area_slug"]) if (idx(k) < 0) throw new Error(`Missing column: ${k}`);
    const { data: areas, error: areasError } = await context.supabase.from("areas").select("id, slug");
    if (areasError) throw new Error(areasError.message);
    const areaMap = new Map((areas ?? []).map((a: any) => [a.slug, a.id]));
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: ImportIssue[] = [];
    const skips: ImportIssue[] = [];
    for (let li = 1; li < rows.length; li++) {
      const row = rows[li];
      const get = (k: string) => (idx(k) >= 0 ? (row[idx(k)]?.trim() ?? "") : "");
      try {
        const name = get("name");
        if (!name) throw new Error("name is required");
        const areaId = areaMap.get(get("area_slug"));
        if (!areaId) throw new Error(`Unknown area_slug: ${get("area_slug")}`);
        const coords = parseOptionalCoords(get("lat"), get("lng"));
        const existingPlace = await findSimilarPlaceInArea(context.supabase, areaId, name);
        if (existingPlace) {
          skipped++;
          skips.push({ row: li + 1, reason: `Skipped similar place: ${existingPlace.name}` });
          continue;
        }
        const { error } = await (context.supabase as any).from("places").insert({
          name,
          area_id: areaId,
          address: get("address") || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          created_by: context.userId,
          status: data.autoApprove ? "approved" : "pending",
        });
        if (error) throw new Error(error.message);
        created++;
      } catch (e: any) {
        failed++;
        errors.push({ row: li + 1, reason: e.message });
      }
    }
    return { created, skipped, failed, errors, skips };
  });

export const exportPlacesCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("places")
      .select("id, name, address, lat, lng, status, created_at, area:areas(slug)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return toCsv(
      ["id", "name", "area_slug", "address", "lat", "lng", "status", "created_at"],
      (data ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        area_slug: p.area?.slug,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        status: p.status,
        created_at: p.created_at,
      })),
    );
  });

export const exportDishesCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("dishes")
      .select(
        `id, name_en, name_th, price_thb, photo_url, note, status, comparisons_count, elo, created_at,
        category:categories(slug), subtype:dish_subtypes(slug), place:places(id, name, area:areas(slug))`,
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return toCsv(
      [
        "id",
        "category_slug",
        "subtype_slug",
        "area_slug",
        "place_name",
        "place_id",
        "dish_name_en",
        "dish_name_th",
        "price_thb",
        "photo_url",
        "note",
        "status",
        "comparisons_count",
        "elo",
        "created_at",
      ],
      (data ?? []).map((d: any) => ({
        id: d.id,
        category_slug: d.category?.slug,
        subtype_slug: d.subtype?.slug,
        area_slug: d.place?.area?.slug,
        place_name: d.place?.name,
        place_id: d.place?.id,
        dish_name_en: d.name_en,
        dish_name_th: d.name_th,
        price_thb: d.price_thb,
        photo_url: d.photo_url,
        note: d.note,
        status: d.status,
        comparisons_count: d.comparisons_count,
        elo: d.elo,
        created_at: d.created_at,
      })),
    );
  });

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQ) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur.replace(/\r$/, ""));
      if (row.some((v) => v.trim().length > 0)) rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  row.push(cur.replace(/\r$/, ""));
  if (row.some((v) => v.trim().length > 0)) rows.push(row);
  return rows;
}

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else cur += c;
    } else {
      if (c === ",") {
        out.push(cur);
        cur = "";
      } else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function cleanHeader(value: string, index: number) {
  return (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim().toLowerCase();
}

function parseOptionalCoords(latText: string, lngText: string) {
  if (!latText && !lngText) return null;
  if (!latText || !lngText) throw new Error("Set both lat and lng, or leave both blank");
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`Invalid lat: ${latText}`);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(`Invalid lng: ${lngText}`);
  return { lat, lng };
}

async function findSimilarPlaceInArea(supabase: any, areaId: string, name: string) {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, status, lat, lng")
    .eq("area_id", areaId)
    .in("status", ["approved", "pending"]);
  if (error) throw new Error(error.message);
  const needle = normalizeMatch(name);
  let best: any = null;
  let bestScore = 0;
  for (const place of data ?? []) {
    const score = similarityScore(needle, normalizeMatch(place.name));
    if (score > bestScore) {
      best = place;
      bestScore = score;
    }
  }
  return bestScore >= PLACE_MATCH_THRESHOLD ? best : null;
}

function normalizeMatch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function similarityScore(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const bigrams = (value: string) => {
    const clean = ` ${value} `;
    const out = new Set<string>();
    for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2));
    return out;
  };
  const aa = bigrams(a);
  const bb = bigrams(b);
  let overlap = 0;
  for (const item of aa) if (bb.has(item)) overlap++;
  return (2 * overlap) / (aa.size + bb.size);
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return `\uFEFF${headers.join(",")}\n${rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")).join("\n")}`;
}

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Categories & Areas admin
const slugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/);
const cuisineSchema = slugSchema.optional();

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { slug: string; name_en: string; name_th: string; cuisine?: string }) =>
    z
      .object({
        slug: z
          .string()
          .min(1)
          .max(60)
          .regex(/^[a-z0-9-]+$/),
        name_en: z.string().min(1).max(80),
        name_th: z.string().min(1).max(80),
        cuisine: cuisineSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("categories")
      .upsert({ ...data, cuisine: data.cuisine || null }, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { slug: string; name_en: string; name_th: string }) =>
    z
      .object({
        slug: z
          .string()
          .min(1)
          .max(60)
          .regex(/^[a-z0-9-]+$/),
        name_en: z.string().min(1).max(80),
        name_th: z.string().min(1).max(80),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("areas").upsert(data, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertCuisine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { slug: string; name_en: string; name_th: string }) =>
    z
      .object({
        slug: slugSchema,
        name_en: z.string().min(1).max(80),
        name_th: z.string().min(1).max(80),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("cuisines").upsert(data, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCuisine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { slug: string }) => z.object({ slug: slugSchema }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { count, error: countError } = await context.supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("cuisine", data.slug);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) throw new Error(`Cannot delete cuisine while ${count} categor${count === 1 ? "y" : "ies"} use it.`);
    const { error } = await context.supabase.from("cuisines").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { count, error: countError } = await context.supabase
      .from("dishes")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) throw new Error(`Cannot delete category while ${count} dish${count === 1 ? "" : "es"} use it.`);
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { count, error: countError } = await context.supabase
      .from("places")
      .select("id", { count: "exact", head: true })
      .eq("area_id", data.id);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) throw new Error(`Cannot delete area while ${count} place${count === 1 ? "" : "s"} use it.`);
    const { error } = await context.supabase.from("areas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantAdminSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Static email allowlist. ADMIN_EMAILS is a comma-separated list configured server-side.
    const raw = process.env.ADMIN_EMAILS ?? "";
    const allow = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const email = (context.claims?.email as string | undefined)?.toLowerCase();
    if (!email) throw new Error("No email on session");
    if (!allow.includes(email)) throw new Error("This email is not in the admin allowlist");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPendingPlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("places")
      .select("id, name, address, status, created_at, area:areas(name_en)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCategoriesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("categories")
      .select("id, slug, name_en, name_th, cuisine, cuisine_ref:cuisines(slug, name_en, name_th), subtypes:dish_subtypes(id, slug, name_en, name_th, is_active, display_order)")
      .order("name_en", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSubtype = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    category_id: string;
    slug?: string;
    name_en: string;
    name_th: string;
    is_active?: boolean;
    display_order?: number;
  }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        category_id: z.string().uuid(),
        slug: z
          .string()
          .min(1)
          .max(60)
          .regex(/^[a-z0-9-]+$/)
          .optional(),
        name_en: z.string().min(1).max(80),
        name_th: z.string().min(1).max(80),
        is_active: z.boolean().optional(),
        display_order: z.number().int().min(0).max(10000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("dish_subtypes")
        .update({
          name_en: data.name_en,
          name_th: data.name_th,
          is_active: data.is_active ?? true,
          display_order: data.display_order ?? 0,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (!data.slug) throw new Error("Slug is required");
    const { error } = await context.supabase.from("dish_subtypes").insert({
      category_id: data.category_id,
      slug: data.slug,
      name_en: data.name_en,
      name_th: data.name_th,
      is_active: data.is_active ?? true,
      display_order: data.display_order ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAreasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("areas")
      .select("id, slug, name_en, name_th")
      .order("name_en", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPlacesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { query?: string }) =>
    z.object({ query: z.string().max(120).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("places")
      .select("id, name, address, status, lat, lng, area:areas(id, name_en, name_th)")
      .in("status", ["approved", "pending"])
      .order("name", { ascending: true })
      .limit(250);
    if (error) throw new Error(error.message);
    const term = data.query?.trim().toLowerCase();
    if (!term) return rows ?? [];
    return (rows ?? []).filter((place: any) =>
      [place.name, place.address, place.area?.name_en, place.area?.name_th]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  });

export const updatePlaceCoordinatesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; lat?: number | null; lng?: number | null }) =>
    z
      .object({
        id: z.string().uuid(),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
      })
      .refine((v) => (v.lat == null && v.lng == null) || (v.lat != null && v.lng != null), "Set both latitude and longitude, or clear both.")
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await (context.supabase as any)
      .from("places")
      .update({ lat: data.lat ?? null, lng: data.lng ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePlaceAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; name: string; areaId: string; address?: string; status: "approved" | "pending" | "rejected"; lat?: number | null; lng?: number | null }) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        areaId: z.string().uuid(),
        address: z.string().trim().max(300).optional(),
        status: z.enum(["approved", "pending", "rejected"]),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
      })
      .refine((v) => (v.lat == null && v.lng == null) || (v.lat != null && v.lng != null), "Set both latitude and longitude, or clear both.")
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await (context.supabase as any)
      .from("places")
      .update({
        name: data.name,
        area_id: data.areaId,
        address: data.address || null,
        status: data.status,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moderatePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; action: "approve" | "reject" }) =>
    z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const status = data.action === "approve" ? "approved" : "rejected";
    const { error } = await context.supabase.from("places").update({ status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
