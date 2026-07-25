import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dishSelect, mcpUserClient } from "../supabase";

export default defineTool({
  name: "list_dishes",
  title: "List dishes",
  description:
    "List approved dishes on JaanNee, optionally filtered by category (and sub-type) and/or area. Subtype-scoped categories require a `subtypeSlug`; multiple ranking pools are never combined. Returns up to 50 dishes ordered by Elo (highest first).",
  inputSchema: {
    categorySlug: z.string().optional().describe("Category slug from list_categories. Required if subtypeSlug is provided."),
    subtypeSlug: z.string().optional().describe("Sub-type slug from list_categories.subtypes. Required when the chosen category is subtype-scoped. Cannot be supplied for a category that is not subtype-scoped."),
    areaSlug: z.string().optional().describe("Area slug from list_areas. Omit to search all areas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ categorySlug, subtypeSlug, areaSlug }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (subtypeSlug && !categorySlug) {
      return { content: [{ type: "text", text: "subtypeSlug requires categorySlug" }], isError: true };
    }
    const supabase = mcpUserClient(ctx);
    const [catRes, areaRes] = await Promise.all([
      categorySlug
        ? supabase.from("categories").select("id, slug, requires_subtype").eq("slug", categorySlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      areaSlug
        ? supabase.from("areas").select("id").eq("slug", areaSlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);
    if (categorySlug && catRes.error) return { content: [{ type: "text", text: catRes.error.message }], isError: true };
    if (categorySlug && !catRes.data) return { content: [{ type: "text", text: `Unknown category slug: ${categorySlug}` }], isError: true };
    if (areaSlug && areaRes.error) return { content: [{ type: "text", text: areaRes.error.message }], isError: true };
    if (areaSlug && !areaRes.data) return { content: [{ type: "text", text: `Unknown area slug: ${areaSlug}` }], isError: true };

    let subtypeId: string | null = null;
    let scoped = false;
    let poolType: "category" | "subtype" | "all" = "all";
    if (catRes.data) {
      const { data: subs, error: subErr } = await supabase
        .from("dish_subtypes")
        .select("id, slug, category_id, is_active")
        .eq("category_id", (catRes.data as any).id);
      if (subErr) return { content: [{ type: "text", text: subErr.message }], isError: true };
      const activeSubs = (subs ?? []).filter((s: any) => s.is_active);
      scoped = Boolean((catRes.data as any).requires_subtype) || activeSubs.length > 0;
      if (scoped) {
        if (!subtypeSlug) {
          return { content: [{ type: "text", text: `Category '${categorySlug}' is subtype-scoped. Supply a subtypeSlug from list_categories.` }], isError: true };
        }
        const sub = activeSubs.find((s: any) => s.slug === subtypeSlug);
        if (!sub) {
          return { content: [{ type: "text", text: `Unknown or inactive subtypeSlug for '${categorySlug}': ${subtypeSlug}` }], isError: true };
        }
        subtypeId = sub.id;
        poolType = "subtype";
      } else {
        if (subtypeSlug) {
          return { content: [{ type: "text", text: `Category '${categorySlug}' does not use sub-types.` }], isError: true };
        }
        poolType = "category";
      }
    }

    let q = supabase.from("dishes").select(dishSelect(Boolean(areaSlug)));
    q = q.eq("status", "approved").not("category_id", "is", null).order("elo", { ascending: false }).limit(50);
    if (catRes.data) q = q.eq("category_id", (catRes.data as any).id);
    if (subtypeId) q = q.eq("subtype_id", subtypeId);
    else if (scoped === false && catRes.data) q = q.is("subtype_id", null);
    if (areaRes.data) q = q.eq("place.area_id", (areaRes.data as any).id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: {
        dishes: rows,
        count: rows.length,
        pool: {
          categorySlug: categorySlug ?? null,
          subtypeSlug: subtypeSlug ?? null,
          type: poolType,
          requires_subtype: scoped,
        },
      },
    };
  },
});
