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
        `id, name_en, name_th, price_thb, photo_url, note, status, created_at,
        category:categories(name_en, slug), place:places(name, area:areas(name_en))`,
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const moderateDish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; action: "approve" | "reject" | "needs_update" | "clear_update" }) =>
    z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject", "needs_update", "clear_update"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
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

// CSV: category_slug,area_slug,place_name,address,dish_name_en,dish_name_th,price_thb,photo_url,note
export const bulkImportCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { csv: string; autoApprove?: boolean }) =>
    z.object({ csv: z.string().min(1).max(500000), autoApprove: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const lines = data.csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row");
    const header = parseCsvRow(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = (k: string) => header.indexOf(k);
    const need = ["category_slug", "area_slug", "place_name", "dish_name_en"];
    for (const k of need) if (idx(k) < 0) throw new Error(`Missing column: ${k}`);

    const [{ data: cats }, { data: areas }] = await Promise.all([
      context.supabase.from("categories").select("id, slug"),
      context.supabase.from("areas").select("id, slug"),
    ]);
    const catMap = new Map((cats ?? []).map((c: any) => [c.slug, c.id]));
    const areaMap = new Map((areas ?? []).map((a: any) => [a.slug, a.id]));

    let created = 0;
    const errors: string[] = [];
    for (let li = 1; li < lines.length; li++) {
      const row = parseCsvRow(lines[li]);
      const get = (k: string) => (idx(k) >= 0 ? (row[idx(k)]?.trim() ?? "") : "");
      try {
        const catId = catMap.get(get("category_slug"));
        const areaId = areaMap.get(get("area_slug"));
        if (!catId) throw new Error(`Unknown category_slug: ${get("category_slug")}`);
        if (!areaId) throw new Error(`Unknown area_slug: ${get("area_slug")}`);
        const placeName = get("place_name");
        // find or create place
        let placeId: string | null = null;
        const { data: existingPlace } = await context.supabase
          .from("places")
          .select("id")
          .eq("area_id", areaId)
          .ilike("name", placeName)
          .maybeSingle();
        if (existingPlace) placeId = existingPlace.id;
        else {
          const { data: np, error: npe } = await context.supabase
            .from("places")
            .insert({
              name: placeName,
              area_id: areaId,
              address: get("address") || null,
              created_by: context.userId,
              status: data.autoApprove ? "approved" : "pending",
            })
            .select("id")
            .single();
          if (npe) throw new Error(npe.message);
          placeId = np.id;
        }
        const priceStr = get("price_thb");
        const price = priceStr ? Number(priceStr) : null;
        const { error: die } = await context.supabase.from("dishes").insert({
          name_en: get("dish_name_en"),
          name_th: get("dish_name_th") || null,
          place_id: placeId,
          category_id: catId,
          price_thb: price,
          photo_url: get("photo_url") || null,
          note: get("note") || null,
          status: data.autoApprove ? "approved" : "pending",
          submitted_by: context.userId,
        });
        if (die) throw new Error(die.message);
        created++;
      } catch (e: any) {
        errors.push(`Row ${li + 1}: ${e.message}`);
      }
    }
    return { created, errors };
  });

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

// Categories & Areas admin
export const upsertCategory = createServerFn({ method: "POST" })
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
    const { error } = await context.supabase.from("categories").upsert(data, { onConflict: "slug" });
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
