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
        place_id, category_id, subtype_id,
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
        .select("category_id, subtype_id")
        .eq("id", data.id)
        .maybeSingle();
      if (checkError) throw new Error(checkError.message);
      if (!dish?.category_id) throw new Error("Assign a category before approving this dish");
      // Application-level pre-check so the admin gets a clear message
      // before the DB trigger fires.
      const { data: catRow, error: catErr } = await context.supabase
        .from("categories")
        .select("requires_subtype")
        .eq("id", dish.category_id)
        .maybeSingle();
      if (catErr) throw new Error(catErr.message);
      const { data: activeSubs, error: subsErr } = await context.supabase
        .from("dish_subtypes")
        .select("id, is_active")
        .eq("category_id", dish.category_id)
        .eq("is_active", true);
      if (subsErr) throw new Error(subsErr.message);
      const scoped = Boolean((catRow as any)?.requires_subtype) || (activeSubs ?? []).length > 0;
      if (scoped && !dish.subtype_id) {
        throw new Error("This category requires a dish type before approval.");
      }
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
  .inputValidator((i: { dishId: string; categoryId: string; subtypeId?: string | null }) =>
    z
      .object({
        dishId: z.string().uuid(),
        categoryId: z.string().uuid(),
        subtypeId: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    // Determine whether the target category is subtype-scoped.
    const { data: cat, error: ce } = await context.supabase
      .from("categories")
      .select("id, requires_subtype")
      .eq("id", data.categoryId)
      .maybeSingle();
    if (ce) throw new Error(ce.message);
    if (!cat) throw new Error("Category not found");
    const { data: activeSubs, error: se } = await context.supabase
      .from("dish_subtypes")
      .select("id, category_id, is_active")
      .eq("category_id", data.categoryId)
      .eq("is_active", true);
    if (se) throw new Error(se.message);
    const scoped = Boolean((cat as any).requires_subtype) || (activeSubs ?? []).length > 0;
    let subtypeId: string | null = null;
    if (scoped) {
      if (!data.subtypeId) throw new Error("This category requires a dish type â€” pick one before assigning.");
      const match = (activeSubs ?? []).find((s: any) => s.id === data.subtypeId);
      if (!match) throw new Error("Selected dish type does not belong to this category or is inactive.");
      subtypeId = data.subtypeId;
    } else {
      if (data.subtypeId) throw new Error("This category does not use dish types.");
    }
    const { error } = await context.supabase
      .from("dishes")
      .update({
        category_id: data.categoryId,
        subtype_id: subtypeId,
        requested_category_en: null,
        requested_category_th: null,
      })
      .eq("id", data.dishId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createCategoryForDishAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { dishId: string; slug: string; name_en: string; name_th: string; cuisine?: string; requires_subtype?: boolean }) =>
    z
      .object({
        dishId: z.string().uuid(),
        slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
        name_en: z.string().min(1).max(80),
        name_th: z.string().min(1).max(80),
        cuisine: z.string().max(60).optional(),
        requires_subtype: z.boolean().optional(),
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
        requires_subtype: data.requires_subtype ?? false,
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
    return { ok: true, requires_subtype: !!data.requires_subtype };
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
    if (error) {
      const msg = /ranking history/i.test(error.message)
        ? "This dish has ranking history and cannot be deleted or merged."
        : error.message;
      throw new Error(msg);
    }
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
    // Atomic safe merge (see supabase/manual/20260725_integrity_hardening.sql).
    // Merging is rejected when either dish already has comparison history.
    // Tried marks and reports move to the kept dish. Comparison rows, Elo,
    // and comparisons_count are never rewritten or deleted by merge.
    const { error } = await (supabaseAdmin as any).rpc("admin_merge_dishes", {
      _keep_id: data.keepId,
      _remove_id: data.removeId,
    });
    if (error) throw new Error(error.message);
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
      context.supabase.from("categories").select("id, slug, requires_subtype, subtypes:dish_subtypes(id, slug, is_active)"),
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
        const cß®ô¶‰žËkºwµçUÉÉ½È¡%¹Ù…±¥±¹œè€‘í±¹Q•áÑõ€¤ì4(€É•ÑÕÉ¸ì±…Ð°±¹œôì4)ô4(4)…Íå¹Œ™Õ¹Ñ¥½¸™¥¹‘M¥µ¥±…ÉA±…•%¹É•„¡ÍÕÁ…‰…Í”è…¹ä°…É•…%èÍÑÉ¥¹œ°¹…µ”èÍÑÉ¥¹œ¤ì4(€½¹ÍÐì‘…Ñ„°•ÉÉ½Èô€ô…Ý…¥ÐÍÕÁ…‰…Í”4(€€€€¹™É½´ ‰Á±…•Ìˆ¤4(€€€€¹Í•±•Ð ‰¥°¹…µ”°ÍÑ…ÑÕÌ°±…Ð°±¹œˆ¤4(€€€€¹•Ä ‰…É•…}¥ˆ°…É•…%¤4(€€€€¹¥¸ ‰ÍÑ…ÑÕÌˆ°l‰…ÁÁÉ½Ù•ˆ°€‰Á•¹‘¥¹œ‰t¤ì4(€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€½¹ÍÐ¹••‘±”€ô¹½Éµ…±¥é•5…Ñ ¡¹…µ”¤ì4(€±•Ð‰•ÍÐè…¹ä€ô¹Õ±°ì4(€±•Ð‰•ÍÑM½É”€ô€Àì4(€™½È€¡½¹ÍÐÁ±…”½˜‘…Ñ„€üümt¤ì4(€€€½¹ÍÐÍ½É”€ôÍ¥µ¥±…É¥ÑåM½É”¡¹••‘±”°¹½Éµ…±¥é•5…Ñ ¡Á±…”¹¹…µ”¤¤ì4(€€€¥˜€¡Í½É”€ø‰•ÍÑM½É”¤ì4(€€€€€‰•ÍÐ€ôÁ±…”ì4(€€€€€‰•ÍÑM½É”€ôÍ½É”ì4(€€€ô4(€ô4(€É•ÑÕÉ¸‰•ÍÑM½É”€øôA1}5Q!}Q!IM!=1€ü‰•ÍÐ€è¹Õ±°ì4)ô4(4)™Õ¹Ñ¥½¸¹½Éµ…±¥é•5…Ñ ¡Ù…±Õ”èÍÑÉ¥¹œ¤ì4(€É•ÑÕÉ¸Ù…±Õ”¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤¹É•Á±…” ½qÌ¬½œ°€ˆ€ˆ¤ì4)ô4(4)™Õ¹Ñ¥½¸Í¥µ¥±…É¥ÑåM½É”¡„èÍÑÉ¥¹œ°ˆèÍÑÉ¥¹œ¤ì4(€¥˜€ …„ñð€…ˆ¤É•ÑÕÉ¸€Àì4(€¥˜€¡„€ôôôˆ¤É•ÑÕÉ¸€Äì4(€¥˜€¡„¹¥¹±Õ‘•Ì¡ˆ¤ñðˆ¹¥¹±Õ‘•Ì¡„¤¤É•ÑÕÉ¸€À¸äì4(€½¹ÍÐ‰¥É…µÌ€ô€¡Ù…±Õ”èÍÑÉ¥¹œ¤€ôøì4(€€€½¹ÍÐ±•…¸€ô€€‘íÙ…±Õ•ô€ì4(€€€½¹ÍÐ½ÕÐ€ô¹•ÜM•ÐñÍÑÉ¥¹œø ¤ì4(€€€™½È€¡±•Ð¤€ô€Àì¤€ð±•…¸¹±•¹Ñ €´€Äì¤¬¬¤½ÕÐ¹…‘¡±•…¸¹Í±¥”¡¤°¤€¬€È¤¤ì4(€€€É•ÑÕÉ¸½ÕÐì4(€ôì4(€½¹ÍÐ…„€ô‰¥É…µÌ¡„¤ì4(€½¹ÍÐ‰ˆ€ô‰¥É…µÌ¡ˆ¤ì4(€±•Ð½Ù•É±…À€ô€Àì4(€™½È€¡½¹ÍÐ¥Ñ•´½˜…„¤¥˜€¡‰ˆ¹¡…Ì¡¥Ñ•´¤¤½Ù•É±…À¬¬ì4(€É•ÑÕÉ¸€ È€¨½Ù•É±…À¤€¼€¡…„¹Í¥é”€¬‰ˆ¹Í¥é”¤ì4)ô4(4)™Õ¹Ñ¥½¸Ñ½ÍØ¡¡•…‘•ÉÌèÍÑÉ¥¹mt°É½ÝÌèÉÉ…äñI•½ÉñÍÑÉ¥¹œ°Õ¹­¹½Ý¸øø¤ì4(€É•ÑÕÉ¸qÕ‘í¡•…‘•ÉÌ¹©½¥¸ ˆ°ˆ¥õq¸‘íÉ½ÝÌ¹µ…À ¡É½Ü¤€ôø¡•…‘•ÉÌ¹µ…À ¡ ¤€ôøÍÙ•±°¡É½Ým¡t¤¤¹©½¥¸ ˆ°ˆ¤¤¹©½¥¸ ‰q¸ˆ¥õ€ì4)ô4(4)™Õ¹Ñ¥½¸ÍÙ•±°¡Ù…±Õ”èÕ¹­¹½Ý¸¤ì4(€¥˜€¡Ù…±Õ”€ôô¹Õ±°¤É•ÑÕÉ¸€ˆˆì4(€½¹ÍÐÑ•áÐ€ôMÑÉ¥¹œ¡Ù…±Õ”¤ì4(€É•ÑÕÉ¸€½lˆ±qÉq¹t¼¹Ñ•ÍÐ¡Ñ•áÐ¤€ü€ˆ‘íÑ•áÐ¹É•Á±…” ¼ˆ½œ°€œˆˆœ¥ô‰€€èÑ•áÐì4)ô4(4(¼¼…Ñ•½É¥•Ì€˜É•…Ì…‘µ¥¸4)½¹ÍÐÍ±ÕM¡•µ„€ôè4(€€¹ÍÑÉ¥¹œ ¤4(€€¹µ¥¸ Ä¤4(€€¹µ…à ØÀ¤4(€€¹É••à ½ym„µèÀ´äµt¬¼¤ì4)½¹ÍÐÕ¥Í¥¹•M¡•µ„€ôÍ±ÕM¡•µ„¹½ÁÑ¥½¹…° ¤ì4(4)•áÁ½ÉÐ½¹ÍÐÕÁÍ•ÉÑ…Ñ•½Éä€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èìÍ±ÕœèÍÑÉ¥¹œì¹…µ•}•¸èÍÑÉ¥¹œì¹…µ•}Ñ èÍÑÉ¥¹œìÕ¥Í¥¹”üèÍÑÉ¥¹œìÉ•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”üè‰½½±•…¸ìÉ•™•É•¹•}Á¡½Ñ½}ÕÉ°üèÍÑÉ¥¹œô¤€ôø(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€Í±Õœèè4(€€€€€€€€€€¹ÍÑÉ¥¹œ ¤4(€€€€€€€€€€¹µ¥¸ Ä¤4(€€€€€€€€€€¹µ…à ØÀ¤4(€€€€€€€€€€¹É••à ½ym„µèÀ´äµt¬¼¤°4(€€€€€€€¹…µ•}•¸èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à àÀ¤°4(€€€€€€€¹…µ•}Ñ èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à àÀ¤°4(€€€€€€€Õ¥Í¥¹”èÕ¥Í¥¹•M¡•µ„°(€€€€€€€É•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”èè¹‰½½±•…¸ ¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€É•™•É•¹•}Á¡½Ñ½}ÕÉ°è…‘µ¥¹A¡½Ñ½UÉ±M¡•µ„°(€€€€€ô¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐÁ…å±½…èI•½ÉñÍÑÉ¥¹œ°Õ¹­¹½Ý¸ø€ôì4(€€€€€Í±Õœè‘…Ñ„¹Í±Õœ°4(€€€€€¹…µ•}•¸è‘…Ñ„¹¹…µ•}•¸°4(€€€€€¹…µ•}Ñ è‘…Ñ„¹¹…µ•}Ñ °4(€€€€€Õ¥Í¥¹”è‘…Ñ„¹Õ¥Í¥¹”ñð¹Õ±°°4(€€€ôì4(€€€¥˜€¡ÑåÁ•½˜‘…Ñ„¹É•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”€ôôô€‰‰½½±•…¸ˆ¤Á…å±½…¹É•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”€ô‘…Ñ„¹É•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”ì(€€€¥˜€¡‘…Ñ„¹É•™•É•¹•}Á¡½Ñ½}ÕÉ°€„ôôÕ¹‘•™¥¹•¤ì(€€€€€Á…å±½…¹É•™•É•¹•}Á¡½Ñ½}ÕÉ°€ô‘…Ñ„¹É•™•É•¹•}Á¡½Ñ½}ÕÉ°ñð¹Õ±°ì(€€€ô(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰…Ñ•½É¥•Ìˆ¤4(€€€€€€¹ÕÁÍ•ÉÐ¡Á…å±½……Ì…¹ä°ì½¹½¹™±¥Ðè€‰Í±Õœˆô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÕÁÍ•ÉÑÉ•„€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èìÍ±ÕœèÍÑÉ¥¹œì¹…µ•}•¸èÍÑÉ¥¹œì¹…µ•}Ñ èÍÑÉ¥¹œô¤€ôø4(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€Í±Õœèè4(€€€€€€€€€€¹ÍÑÉ¥¹œ ¤4(€€€€€€€€€€¹µ¥¸ Ä¤4(€€€€€€€€€€¹µ…à ØÀ¤4(€€€€€€€€€€¹É••à ½ym„µèÀ´äµt¬¼¤°4(€€€€€€€¹…µ•}•¸èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à àÀ¤°4(€€€€€€€¹…µ•}Ñ èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à àÀ¤°4(€€€€€ô¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”¹™É½´ ‰…É•…Ìˆ¤¹ÕÁÍ•ÉÐ¡‘…Ñ„°ì½¹½¹™±¥Ðè€‰Í±Õœˆô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÕÁÍ•ÉÑÕ¥Í¥¹”€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èìÍ±ÕœèÍÑÉ¥¹œì¹…µ•}•¸èÍÑÉ¥¹œì¹…µ•}Ñ èÍÑÉ¥¹œô¤€ôø4(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€Í±ÕœèÍ±ÕM¡•µ„°4(€€€€€€€¹…µ•}•¸èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à àÀ¤°4(€€€€€€€¹…µ•}Ñ èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à àÀ¤°4(€€€€€ô¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”¹™É½´ ‰Õ¥Í¥¹•Ìˆ¤¹ÕÁÍ•ÉÐ¡‘…Ñ„°ì½¹½¹™±¥Ðè€‰Í±Õœˆô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐ‘•±•Ñ•Õ¥Í¥¹”€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èìÍ±ÕœèÍÑÉ¥¹œô¤€ôøè¹½‰©•Ð¡ìÍ±ÕœèÍ±ÕM¡•µ„ô¤¹Á…ÉÍ”¡¤¤¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì½Õ¹Ð°•ÉÉ½Èè½Õ¹ÑÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰…Ñ•½É¥•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥ˆ°ì½Õ¹Ðè€‰•á…Ðˆ°¡•…èÑÉÕ”ô¤4(€€€€€€¹•Ä ‰Õ¥Í¥¹”ˆ°‘…Ñ„¹Í±Õœ¤ì4(€€€¥˜€¡½Õ¹ÑÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡½Õ¹ÑÉÉ½È¹µ•ÍÍ…”¤ì4(€€€¥˜€ ¡½Õ¹Ð€üü€À¤€ø€À¤Ñ¡É½Ü¹•ÜÉÉ½È¡…¹¹½Ð‘•±•Ñ”Õ¥Í¥¹”Ý¡¥±”€‘í½Õ¹Ñô…Ñ•½È‘í½Õ¹Ð€ôôô€Ä€ü€‰äˆ€è€‰¥•Ì‰ôÕÍ”¥Ð¹€¤ì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”¹™É½´ ‰Õ¥Í¥¹•Ìˆ¤¹‘•±•Ñ” ¤¹•Ä ‰Í±Õœˆ°‘…Ñ„¹Í±Õœ¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐ‘•±•Ñ•…Ñ•½Éä€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èì¥èÍÑÉ¥¹œô¤€ôøè¹½‰©•Ð¡ì¥èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤ô¤¹Á…ÉÍ”¡¤¤¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì½Õ¹Ð°•ÉÉ½Èè½Õ¹ÑÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰‘¥Í¡•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥ˆ°ì½Õ¹Ðè€‰•á…Ðˆ°¡•…èÑÉÕ”ô¤4(€€€€€€¹•Ä ‰…Ñ•½Éå}¥ˆ°‘…Ñ„¹¥¤ì4(€€€¥˜€¡½Õ¹ÑÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡½Õ¹ÑÉÉ½È¹µ•ÍÍ…”¤ì4(€€€¥˜€ ¡½Õ¹Ð€üü€À¤€ø€À¤Ñ¡É½Ü¹•ÜÉÉ½È¡…¹¹½Ð‘•±•Ñ”…Ñ•½ÉäÝ¡¥±”€‘í½Õ¹Ñô‘¥Í ‘í½Õ¹Ð€ôôô€Ä€ü€ˆˆ€è€‰•Ì‰ôÕÍ”¥Ð¹€¤ì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”¹™É½´ ‰…Ñ•½É¥•Ìˆ¤¹‘•±•Ñ” ¤¹•Ä ‰¥ˆ°‘…Ñ„¹¥¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐ‘•±•Ñ•É•„€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èì¥èÍÑÉ¥¹œô¤€ôøè¹½‰©•Ð¡ì¥èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤ô¤¹Á…ÉÍ”¡¤¤¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì½Õ¹Ð°•ÉÉ½Èè½Õ¹ÑÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰Á±…•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥ˆ°ì½Õ¹Ðè€‰•á…Ðˆ°¡•…èÑÉÕ”ô¤4(€€€€€€¹•Ä ‰…É•…}¥ˆ°‘…Ñ„¹¥¤ì4(€€€¥˜€¡½Õ¹ÑÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡½Õ¹ÑÉÉ½È¹µ•ÍÍ…”¤ì4(€€€¥˜€ ¡½Õ¹Ð€üü€À¤€ø€À¤Ñ¡É½Ü¹•ÜÉÉ½È¡…¹¹½Ð‘•±•Ñ”…É•„Ý¡¥±”€‘í½Õ¹ÑôÁ±…”‘í½Õ¹Ð€ôôô€Ä€ü€ˆˆ€è€‰Ì‰ôÕÍ”¥Ð¹€¤ì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”¹™É½´ ‰…É•…Ìˆ¤¹‘•±•Ñ” ¤¹•Ä ‰¥ˆ°‘…Ñ„¹¥¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÉ…¹Ñ‘µ¥¹M•±˜€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì½¹Ñ•áÐô¤€ôøì4(€€€€¼¼MÑ…Ñ¥Œ•µ…¥°…±±½Ý±¥ÍÐ¸5%9}5%1L¥Ì„½µµ„µÍ•Á…É…Ñ•±¥ÍÐ½¹™¥ÕÉ•Í•ÉÙ•ÈµÍ¥‘”¸4(€€€½¹ÍÐÉ…Ü€ôÁÉ½•ÍÌ¹•¹Ø¹5%9}5%1L€üü€ˆˆì4(€€€½¹ÍÐ…±±½Ü€ôÉ…Ü4(€€€€€€¹ÍÁ±¥Ð ˆ°ˆ¤4(€€€€€€¹µ…À ¡Ì¤€ôøÌ¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤¤4(€€€€€€¹™¥±Ñ•È¡	½½±•…¸¤ì4(€€€½¹ÍÐ•µ…¥°€ô€¡½¹Ñ•áÐ¹±…¥µÌü¹•µ…¥°…ÌÍÑÉ¥¹œðÕ¹‘•™¥¹•¤ü¹Ñ½1½Ý•É…Í” ¤ì4(€€€¥˜€ …•µ…¥°¤Ñ¡É½Ü¹•ÜÉÉ½È ‰9¼•µ…¥°½¸Í•ÍÍ¥½¸ˆ¤ì4(€€€¥˜€ ……±±½Ü¹¥¹±Õ‘•Ì¡•µ…¥°¤¤Ñ¡É½Ü¹•ÜÉÉ½È ‰Q¡¥Ì•µ…¥°¥Ì¹½Ð¥¸Ñ¡”…‘µ¥¸…±±½Ý±¥ÍÐˆ¤ì4(€€€½¹ÍÐìÍÕÁ…‰…Í•‘µ¥¸ô€ô…Ý…¥Ð¥µÁ½ÉÐ ‰ ½¥¹Ñ•É…Ñ¥½¹Ì½ÍÕÁ…‰…Í”½±¥•¹Ð¹Í•ÉÙ•Èˆ¤ì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥ÐÍÕÁ…‰…Í•‘µ¥¸4(€€€€€€¹™É½´ ‰ÕÍ•É}É½±•Ìˆ¤4(€€€€€€¹ÕÁÍ•ÉÐ¡ìÕÍ•É}¥è½¹Ñ•áÐ¹ÕÍ•É%°É½±”è€‰…‘µ¥¸ˆô°ì½¹½¹™±¥Ðè€‰ÕÍ•É}¥±É½±”ˆô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐ±¥ÍÑA•¹‘¥¹A±…•Ì€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰Pˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì‘…Ñ„°•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰Á±…•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°¹…µ”°…‘‘É•ÍÌ°ÍÑ…ÑÕÌ°É•…Ñ•‘}…Ð°…É•„é…É•…Ì¡¹…µ•}•¸¤ˆ¤4(€€€€€€¹•Ä ‰ÍÑ…ÑÕÌˆ°€‰Á•¹‘¥¹œˆ¤4(€€€€€€¹½É‘•È ‰É•…Ñ•‘}…Ðˆ°ì…Í•¹‘¥¹œè™…±Í”ô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸‘…Ñ„€üümtì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐ±¥ÍÑ…Ñ•½É¥•Í‘µ¥¸€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰Pˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì‘…Ñ„°•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰…Ñ•½É¥•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°Í±Õœ°¹…µ•}•¸°¹…µ•}Ñ °Õ¥Í¥¹”°É•™•É•¹•}Á¡½Ñ½}ÕÉ°°É•ÅÕ¥É•Í}ÍÕ‰ÑåÁ”°Õ¥Í¥¹•}É•˜éÕ¥Í¥¹•Ì¡Í±Õœ°¹…µ•}•¸°¹…µ•}Ñ ¤°ÍÕ‰ÑåÁ•Ìé‘¥Í¡}ÍÕ‰ÑåÁ•Ì¡¥°Í±Õœ°¹…µ•}•¸°¹…µ•}Ñ °¥Í}…Ñ¥Ù”°‘¥ÍÁ±…å}½É‘•È¤ˆ¤(€€€€€€¹½É‘•È ‰¹…µ•}•¸ˆ°ì…Í•¹‘¥¹œèÑÉÕ”ô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸‘…Ñ„€üümtì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÕÁÍ•ÉÑMÕ‰ÑåÁ”€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èì4(€€€¥üèÍÑÉ¥¹œì4(€€€…Ñ•½Éå}¥èÍÑÉ¥¹œì4(€€€Í±ÕœüèÍÑÉ¥¹œì4(€€€¹…µ•}•¸èÍÑÉ¥¹œì4(€€€¹…µ•}Ñ èÍÑÉ¥¹œì4(€€€¥Í}…Ñ¥Ù”üè‰½½±•…¸ì4(€€€‘¥ÍÁ±…å}½É‘•Èüè¹Õµ‰•Èì4(€ô¤€ôø4(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€¥èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€…Ñ•½Éå}¥èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤°4(€€€€€€€Í±Õœèè4(€€€€€€€€€€¹ÍÑÉ¥¹œ ¤4(€€€€€€€€€€¹µ¥¸ Ä¤4(€€€€€€€€€€¹µ…à ØÀ¤4(€€€€€€€€€€¹É••à ½ym„µèÀ´äµt¬¼¤4(€€€€€€€€€€¹½ÁÑ¥½¹…° ¤°4(€€€€€€€¹…µ•}•¸èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à àÀ¤°4(€€€€€€€¹…µ•}Ñ èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à àÀ¤°4(€€€€€€€¥Í}…Ñ¥Ù”èè¹‰½½±•…¸ ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€‘¥ÍÁ±…å}½É‘•Èèè¹¹Õµ‰•È ¤¹¥¹Ð ¤¹µ¥¸ À¤¹µ…à ÄÀÀÀÀ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€ô¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€¥˜€¡‘…Ñ„¹¥¤ì4(€€€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€€€¹™É½´ ‰‘¥Í¡}ÍÕ‰ÑåÁ•Ìˆ¤4(€€€€€€€€¹ÕÁ‘…Ñ”¡ì4(€€€€€€€€€¹…µ•}•¸è‘…Ñ„¹¹…µ•}•¸°4(€€€€€€€€€¹…µ•}Ñ è‘…Ñ„¹¹…µ•}Ñ °4(€€€€€€€€€¥Í}…Ñ¥Ù”è‘…Ñ„¹¥Í}…Ñ¥Ù”€üüÑÉÕ”°4(€€€€€€€€€‘¥ÍÁ±…å}½É‘•Èè‘…Ñ„¹‘¥ÍÁ±…å}½É‘•È€üü€À°4(€€€€€€€ô¤4(€€€€€€€€¹•Ä ‰¥ˆ°‘…Ñ„¹¥¤ì4(€€€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€€€ô4(€€€¥˜€ …‘…Ñ„¹Í±Õœ¤Ñ¡É½Ü¹•ÜÉÉ½È ‰M±Õœ¥ÌÉ•ÅÕ¥É•ˆ¤ì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”¹™É½´ ‰‘¥Í¡}ÍÕ‰ÑåÁ•Ìˆ¤¹¥¹Í•ÉÐ¡ì4(€€€€€…Ñ•½Éå}¥è‘…Ñ„¹…Ñ•½Éå}¥°4(€€€€€Í±Õœè‘…Ñ„¹Í±Õœ°4(€€€€€¹…µ•}•¸è‘…Ñ„¹¹…µ•}•¸°4(€€€€€¹…µ•}Ñ è‘…Ñ„¹¹…µ•}Ñ °4(€€€€€¥Í}…Ñ¥Ù”è‘…Ñ„¹¥Í}…Ñ¥Ù”€üüÑÉÕ”°4(€€€€€‘¥ÍÁ±…å}½É‘•Èè‘…Ñ„¹‘¥ÍÁ±…å}½É‘•È€üü€À°4(€€€ô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐ±¥ÍÑÉ•…Í‘µ¥¸€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰Pˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì‘…Ñ„°•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”4(€€€€€€¹™É½´ ‰…É•…Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°Í±Õœ°¹…µ•}•¸°¹…µ•}Ñ ˆ¤4(€€€€€€¹½É‘•È ‰¹…µ•}•¸ˆ°ì…Í•¹‘¥¹œèÑÉÕ”ô¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸‘…Ñ„€üümtì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐ±¥ÍÑA±…•Í‘µ¥¸€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰Pˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èìÅÕ•ÉäüèÍÑÉ¥¹œô¤€ôø4(€€€è¹½‰©•Ð¡ìÅÕ•Éäèè¹ÍÑÉ¥¹œ ¤¹µ…à ÄÈÀ¤¹½ÁÑ¥½¹…° ¤ô¤¹Á…ÉÍ”¡¤€üüíô¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€±•ÐÅÕ•Éä€ô€¡½¹Ñ•áÐ¹ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€¹™É½´ ‰Á±…•Ìˆ¤4(€€€€€€¹Í•±•Ð ‰¥°¹…µ”°…‘‘É•ÍÌ°ÍÑ…ÑÕÌ°±…Ð°±¹œ°…É•„é…É•…Ì¡¥°¹…µ•}•¸°¹…µ•}Ñ ¤ˆ¤4(€€€€€€¹¥¸ ‰ÍÑ…ÑÕÌˆ°l‰…ÁÁÉ½Ù•ˆ°€‰Á•¹‘¥¹œ‰t¤ì4(4(€€€½¹ÍÐÑ•É´€ô‘…Ñ„¹ÅÕ•Éäü¹ÑÉ¥´ ¤ì4(€€€¥˜€¡Ñ•É´¤ì4(€€€€€½¹ÍÐ•Í…Á•€ôÑ•É´¹É•Á±…” ½l•}t½œ°€¡µ…Ñ ¤€ôøqp‘íµ…Ñ¡õ€¤ì4(€€€€€ÅÕ•Éä€ôÅÕ•Éä¹½È¡¹…µ”¹¥±¥­”¸”‘í•Í…Á•‘ô”±…‘‘É•ÍÌ¹¥±¥­”¸”‘í•Í…Á•‘ô•€¤ì4(€€€ô4(4(€€€½¹ÍÐì‘…Ñ„èÉ½ÝÌ°•ÉÉ½Èô€ô…Ý…¥ÐÅÕ•Éä4(€€€€€€¹½É‘•È ‰±…Ðˆ°ì…Í•¹‘¥¹œèÑÉÕ”°¹Õ±±Í¥ÉÍÐèÑÉÕ”ô¤4(€€€€€€¹½É‘•È ‰±¹œˆ°ì…Í•¹‘¥¹œèÑÉÕ”°¹Õ±±Í¥ÉÍÐèÑÉÕ”ô¤4(€€€€€€¹½É‘•È ‰¹…µ”ˆ°ì…Í•¹‘¥¹œèÑÉÕ”ô¤4(€€€€€€¹±¥µ¥Ð ÄÀÀÀ¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸É½ÝÌ€üümtì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÕÁ‘…Ñ•A±…•½½É‘¥¹…Ñ•Í‘µ¥¸€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èì¥èÍÑÉ¥¹œì±…Ðüè¹Õµ‰•Èð¹Õ±°ì±¹œüè¹Õµ‰•Èð¹Õ±°ô¤€ôø4(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€¥èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤°4(€€€€€€€±…Ðèè¹¹Õµ‰•È ¤¹µ¥¸ ´äÀ¤¹µ…à äÀ¤¹¹Õ±±…‰±” ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€±¹œèè¹¹Õµ‰•È ¤¹µ¥¸ ´ÄàÀ¤¹µ…à ÄàÀ¤¹¹Õ±±…‰±” ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€ô¤4(€€€€€€¹É•™¥¹” ¡Ø¤€ôø€¡Ø¹±…Ð€ôô¹Õ±°€˜˜Ø¹±¹œ€ôô¹Õ±°¤ñð€¡Ø¹±…Ð€„ô¹Õ±°€˜˜Ø¹±¹œ€„ô¹Õ±°¤°€‰M•Ð‰½Ñ ±…Ñ¥ÑÕ‘”…¹±½¹¥ÑÕ‘”°½È±•…È‰½Ñ ¸ˆ¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð€¡½¹Ñ•áÐ¹ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€¹™É½´ ‰Á±…•Ìˆ¤4(€€€€€€¹ÕÁ‘…Ñ”¡ì±…Ðè‘…Ñ„¹±…Ð€üü¹Õ±°°±¹œè‘…Ñ„¹±¹œ€üü¹Õ±°ô¤4(€€€€€€¹•Ä ‰¥ˆ°‘…Ñ„¹¥¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐÕÁ‘…Ñ•A±…•‘µ¥¸€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èì¥èÍÑÉ¥¹œì¹…µ”èÍÑÉ¥¹œì…É•…%èÍÑÉ¥¹œì…‘‘É•ÍÌüèÍÑÉ¥¹œìÍÑ…ÑÕÌè€‰…ÁÁÉ½Ù•ˆð€‰Á•¹‘¥¹œˆð€‰É•©•Ñ•ˆì±…Ðüè¹Õµ‰•Èð¹Õ±°ì±¹œüè¹Õµ‰•Èð¹Õ±°ô¤€ôø4(€€€è4(€€€€€€¹½‰©•Ð¡ì4(€€€€€€€¥èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤°4(€€€€€€€¹…µ”èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ¥¸ Ä¤¹µ…à ÄØÀ¤°4(€€€€€€€…É•…%èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤°4(€€€€€€€…‘‘É•ÍÌèè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ…à ÌÀÀ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€ÍÑ…ÑÕÌèè¹•¹Õ´¡l‰…ÁÁÉ½Ù•ˆ°€‰Á•¹‘¥¹œˆ°€‰É•©•Ñ•‰t¤°4(€€€€€€€±…Ðèè¹¹Õµ‰•È ¤¹µ¥¸ ´äÀ¤¹µ…à äÀ¤¹¹Õ±±…‰±” ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€€€±¹œèè¹¹Õµ‰•È ¤¹µ¥¸ ´ÄàÀ¤¹µ…à ÄàÀ¤¹¹Õ±±…‰±” ¤¹½ÁÑ¥½¹…° ¤°4(€€€€€ô¤4(€€€€€€¹É•™¥¹” ¡Ø¤€ôø€¡Ø¹±…Ð€ôô¹Õ±°€˜˜Ø¹±¹œ€ôô¹Õ±°¤ñð€¡Ø¹±…Ð€„ô¹Õ±°€˜˜Ø¹±¹œ€„ô¹Õ±°¤°€‰M•Ð‰½Ñ ±…Ñ¥ÑÕ‘”…¹±½¹¥ÑÕ‘”°½È±•…È‰½Ñ ¸ˆ¤4(€€€€€€¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð€¡½¹Ñ•áÐ¹ÍÕÁ…‰…Í”…Ì…¹ä¤4(€€€€€€¹™É½´ ‰Á±…•Ìˆ¤4(€€€€€€¹ÕÁ‘…Ñ”¡ì4(€€€€€€€¹…µ”è‘…Ñ„¹¹…µ”°4(€€€€€€€…É•…}¥è‘…Ñ„¹…É•…%°4(€€€€€€€…‘‘É•ÍÌè‘…Ñ„¹…‘‘É•ÍÌñð¹Õ±°°4(€€€€€€€ÍÑ…ÑÕÌè‘…Ñ„¹ÍÑ…ÑÕÌ°4(€€€€€€€±…Ðè‘…Ñ„¹±…Ð€üü¹Õ±°°4(€€€€€€€±¹œè‘…Ñ„¹±¹œ€üü¹Õ±°°4(€€€€€ô¤4(€€€€€€¹•Ä ‰¥ˆ°‘…Ñ„¹¥¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(4)•áÁ½ÉÐ½¹ÍÐµ½‘•É…Ñ•A±…”€ôÉ•…Ñ•M•ÉÙ•É¸¡ìµ•Ñ¡½è€‰A=MPˆô¤4(€€¹µ¥‘‘±•Ý…É”¡mÉ•ÅÕ¥É•MÕÁ…‰…Í•ÕÑ¡t¤4(€€¹¥¹ÁÕÑY…±¥‘…Ñ½È ¡¤èì¥èÍÑÉ¥¹œì…Ñ¥½¸è€‰…ÁÁÉ½Ù”ˆð€‰É•©•Ðˆô¤€ôø4(€€€è¹½‰©•Ð¡ì¥èè¹ÍÑÉ¥¹œ ¤¹ÕÕ¥ ¤°…Ñ¥½¸èè¹•¹Õ´¡l‰…ÁÁÉ½Ù”ˆ°€‰É•©•Ð‰t¤ô¤¹Á…ÉÍ”¡¤¤°4(€€¤4(€€¹¡…¹‘±•È¡…Íå¹Œ€¡ì‘…Ñ„°½¹Ñ•áÐô¤€ôøì4(€€€…Ý…¥Ð•¹ÍÕÉ•‘µ¥¸¡½¹Ñ•áÐ¤ì4(€€€½¹ÍÐÍÑ…ÑÕÌ€ô‘…Ñ„¹…Ñ¥½¸€ôôô€‰…ÁÁÉ½Ù”ˆ€ü€‰…ÁÁÉ½Ù•ˆ€è€‰É•©•Ñ•ˆì4(€€€½¹ÍÐì•ÉÉ½Èô€ô…Ý…¥Ð½¹Ñ•áÐ¹ÍÕÁ…‰…Í”¹™É½´ ‰Á±…•Ìˆ¤¹ÕÁ‘…Ñ”¡ìÍÑ…ÑÕÌô¤¹•Ä ‰¥ˆ°‘…Ñ„¹¥¤ì4(€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”¤ì4(€€€É•ÑÕÉ¸ì½¬èÑÉÕ”ôì4(€ô¤ì4(