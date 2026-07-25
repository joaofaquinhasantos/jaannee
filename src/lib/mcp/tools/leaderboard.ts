import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dishSelect, mcpUserClient } from "../supabase";

export default defineTool({
  name: "leaderboard",
  title: "Dish leaderboard",
  description:
    "Return the ranked JaanNee leaderboard for a category (and optional area). Only dishes with at least 5 pairwise comparisons are eligible; results are ordered by Elo (highest first).",
  inputSchema: {
    categorySlug: z.string().describe("Category slug from list_categories, e.g. 'pad-thai'."),
    subtypeSlug: z.string().optional().describe("Sub-type slug from list_categories.subtypes. Required when the category has active sub-types."),
    areaSlug: z.string().optional().describe("Area slug from list_areas. Omit for all areas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ categorySlug, subtypeSlug, areaSlug }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = mcpUserClient(ctx);
    const [catRes, areaRes] = await Promise.all([
      supabase.from("categories").select("id, requires_subtype").eq("slug", categorySlug).maybeSingle(),
      areaSlug
        ? supabase.from("areas").select("id").eq("slug", areaSlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);
    if (!catRes.data) {
      return { content: [{ type: "text", text: `Unknown category slug: ${categorySlug}` }], isError: true };
    }
    if (areaSlug && !areaRes.data) {
      return { content: [{ type: "text", text: `Unknown area slug: ${areaSlug}` }], isError: true };
    }
    const { data: subs } = await supabase
      .from("dish_subtypes")
      .select("id, slug")
      .eq("category_id", (catRes.data as any).id)
      .eq("is_active", true);
    const activeSubs = (subs ?? []) as any[];
    const requires = Boolean((catRes.data as any).requires_subtype) || activeSubs.length > 0;
    let subtypeId: string | null = null;
    if (requires) {
      if (!subtypeSlug) {
        return { content: [{ type: "text", text: `Category '${categorySlug}' requires a subtypeSlug. Call list_categories to see available sub-types.` }], isError: true };
      }
      const sub = activeSubs.find((s) => s.slug === subtypeSlug);
      if (!sub) return { content: [{ type: "text", text: `Unknown or inactive subtypeSlug: ${subtypeSlug}` }], isError: true };
      subtypeId = sub.id;
    }
    let q = supabase.from("dishes").select(dishSelect(Boolean(areaSlug)));
    q = q
      .eq("status", "approved")
      .not("category_id", "is", null)
      .eq("category_id", catRes.data.id)
      .gte("comparisons_count", 5)
      .order("elo", { ascending: false })
      .limit(50);
    if (subtypeId) q = q.eq("subtype_id", subtypeId);
    else q = q.is("subtype_id", null);
    if (areaRes.data) q = q.eq("place.area_id", areaRes.data.id);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { leaderboard: rows, count: rows.length },
    };
  },
});