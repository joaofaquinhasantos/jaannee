import { defineTool } from "@lovable.dev/mcp-js";
import { mcpUserClient } from "../supabase";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description:
    "List all dish categories on JaanNee (e.g. Pad Thai, Tom Yum). Each category returns slug, English + Thai names, cuisine, a `requires_subtype` flag, and any active dish sub-types. When `requires_subtype` is true or `subtypes` is non-empty, other tools that operate on rankings (list_dishes, leaderboard) require a `subtypeSlug`.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = mcpUserClient(ctx);
    const { data, error } = await supabase
      .from("categories")
      .select("slug, name_en, name_th, cuisine, requires_subtype, subtypes:dish_subtypes(slug, name_en, name_th, is_active)")
      .order("name_en");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = ((data ?? []) as any[]).map((c) => ({
      ...c,
      subtypes: ((c.subtypes ?? []) as any[]).filter((s) => s.is_active).map(({ is_active: _ia, ...rest }) => rest),
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { categories: rows },
    };
  },
});