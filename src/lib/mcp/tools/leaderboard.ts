import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dishSelect, mcpPublicClient } from "../supabase";

export default defineTool({
  name: "leaderboard",
  title: "Dish leaderboard",
  description:
    "Return the ranked JaanNee leaderboard for a category (and optional area). Only dishes with at least 5 pairwise comparisons are eligible; results are ordered by Elo (highest first).",
  inputSchema: {
    categorySlug: z.string().describe("Category slug from list_categories, e.g. 'pad-thai'."),
    areaSlug: z.string().optional().describe("Area slug from list_areas. Omit for all areas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ categorySlug, areaSlug }) => {
    const supabase = mcpPublicClient();
    const [catRes, areaRes] = await Promise.all([
      supabase.from("categories").select("id").eq("slug", categorySlug).maybeSingle(),
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
    let q = supabase.from("dishes").select(dishSelect(Boolean(areaSlug)));
    q = q
      .eq("status", "approved")
      .not("category_id", "is", null)
      .eq("category_id", catRes.data.id)
      .gte("comparisons_count", 5)
      .order("elo", { ascending: false })
      .limit(50);
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