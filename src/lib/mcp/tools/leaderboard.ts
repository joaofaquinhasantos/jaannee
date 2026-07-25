import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dishSelect, mcpUserClient } from "../supabase";

export default defineTool({
  name: "leaderboard",
  title: "Dish leaderboard",
  description:
    "Return the ranked JaanNee leaderboard for a category (subtype-scoped when required) and optional area. Only dishes with at least 5 pairwise comparisons are eligible; results are ordered by Elo (highest first). Multiple ranking pools are never combined.",
  inputSchema: {
    categorySlug: z.string().describe("Category slug from list_categories."),
    subtypeSlug: z.string().optional().describe("Sub-type slug from list_categories.subtypes. Required when the category is subtype-scoped; forbidden for category-only categories."),
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
    if (catRes.error) return { content: [{ type: "text", text: catRes.error.message }], isError: true };
    if (!catRes.data) return { content: [{ type: "text", text: `Unknown category slug: ${categorySlug}` }], isError: true };
    if (areaSlug && areaRes.error) return { content: [{ type: "text", text: areaRes.error.message }], isError: true };
    if (areaSlug && !areaRes.data) return { content: [{ type: "text", text: `Unknown area slug: ${areaSlug}` }], isError: true };

    const { data: subs, error: subErr } = await supabase
      .from("dish_subtypes")
      .select("id, slug, category_id, is_active")
      .eq("category_id", (catRes.data as any).id);
    if (subErr) return { content: [{ type: "text", text: subErr.message }], isError: true };
    const activeSubs = (subs ?? []).filter((s: any) => s.is_active);
    const scoped = Boolean((catRes.data as any).requires_subtype) || activeSubs.length > 0;
    let subtypeId: string | null = null;
    let poolType: "category" | "subtype" = "category";
    if (scoped) {
      if (!subtypeSlug) {
        return { content: [{ type: "text", text: `Category '${categorySlug}' is subtype-scoped. Supply a subtypeSlug from list_categories.` }], isError: true };
      }
      const sub = activeSubs.find((s: any) => s.slug === subtypeSlug);
      if (!sub) return { content: [{ type: "text", text: `Unknown or inactive subtypeSlug for '${categorySlug}': ${subtypeSlug}` }], isError: true };
      subtypeId = sub.id;
      poolType = "subtype";
    } else if (subtypeSlug) {
      return { content: [{ type: "text", text: `Category '${categorySlug}' does not use sub-types.` }], isError: true };
    }

    let q = supabase.from("dishes").select(dishSelect(Boolean(areaSlug)));
    q = q
      .eq("status", "approved")
      .not("category_id", "is", null)
      .eq("category_id", (catRes.data as any).id)
      .gte("comparisons_count", 5)
      .order("elo", { ascending: false })
      .limit(50);
    if (subtypeId) q = q.eq("subtype_id", subtypeId);
    else q = q.is("subtype_id", null);
    if (areaRes.data) q = q.eq("place.area_id", (areaRes.data as any).id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: {
        leaderboard: rows,
        count: rows.length,
        pool: {
          categorySlug,
          subtypeSlug: subtypeSlug ?? null,
          type: poolType,
          requires_subtype: scoped,
        },
      },
    };
  },
});
