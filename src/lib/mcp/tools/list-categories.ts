import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpPublicClient } from "../supabase";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description:
    "List all dish categories on JaanNee (e.g. Pad Thai, Tom Yum). Returns slug plus English and Thai names for each category.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = mcpPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("slug, name_en, name_th")
      .order("name_en");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { categories: rows },
    };
  },
});