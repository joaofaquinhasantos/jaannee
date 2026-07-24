import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dishSelect, mcpPublicClient } from "../supabase";

export default defineTool({
  name: "list_dishes",
  title: "List dishes",
  description:
    "List approved dishes on JaanNee, optionally filtered by category slug and/or area slug. Returns up to 50 dishes ordered by Elo ranking (highest first).",
  inputSchema: {
    categorySlug: z
      .string()
      .optional()
      .describe("Category slug from list_categories (e.g. 'pad-thai'). Omit to search all categories."),
    areaSlug: z
      .string()
      .optional()
      .describe("Area slug from list_areas (e.g. 'sathorn'). Omit to search all areas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ categorySlug, areaSlug }) => {
    const supabase = mcpPublicClient();
    const [catRes, areaRes] = await Promise.all([
      categorySlug
        ? supabase.from("categories").select("id").eq("slug", categorySlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      areaSlug
        ? supabase.from("areas").select("id").eq("slug", areaSlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);
    if (categorySlug && !catRes.data) {
      return { content: [{ type: "text", text: `Unknown category slug: ${categorySlug}` }], isError: true };
    }
    if (areaSlug && !areaRes.data) {
      return { content: [{ type: "text", text: `Unknown area slug: ${areaSlug}` }], isError: true };
    }
    let q = supabase.from("dishes").select(dishSelect(Boolean(areaSlug)));
    q = q
      .eq("status", "approved")
      .not("category_id", "is", null)
      .order("elo", { ascending: false })
      .limit(50);
    if (catRes.data) q = q.eq("category_id", catRes.data.id);
    if (areaRes.data) q = q.eq("place.area_id", areaRes.data.id);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { dishes: rows, count: rows.length },
    };
  },
});