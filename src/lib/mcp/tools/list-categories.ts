import { defineTool } from "@lovable.dev/mcp-js";
import { mcpUserClient } from "../supabase";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description:
    "List all dish categories on JaanNee (e.g. Pad Thai, Tom Yum). Each category returns slug, English + Thai names, cuisine (slug + names), `requires_subtype`, and active sub-types ordered by display_order. When `requires_subtype` is true or `subtypes` is non-empty, other tools that operate on rankings (list_dishes, leaderboard) require a `subtypeSlug`.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = mcpUserClient(ctx);
    const { data, error } = await supabase
      .from("categories")
      .select(
        "slug, name_en, name_th, requires_subtype, cuisine_ref:cuisines(slug, name_en, name_th), subtypes:dish_subtypes(slug, name_en, name_th, is_active, display_order)",
      )
      .order("name_en");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = ((data ?? []) as any[]).map((c) => ({
      slug: c.slug,
      name_en: c.name_en,
      name_th: c.name_th,
      requires_subtype: Boolean(c.requires_subtype),
      cuisine: c.cuisine_ref
        ? { slug: c.cuisine_ref.slug, name_en: c.cuisine_ref.name_en, name_th: c.cuisine_ref.name_th }
        : null,
      subtypes: ((c.subtypes ?? []) as any[])
        .filter((s) => s.is_active)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || String(a.name_en).localeCompare(String(b.name_en)))
        .map((s) => ({ slug: s.slug, name_en: s.name_en, name_th: s.name_th, display_order: s.display_order ?? 0 })),
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { categories: rows },
    };
  },
});
