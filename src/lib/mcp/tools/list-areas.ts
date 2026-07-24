import { defineTool } from "@lovable.dev/mcp-js";
import { mcpPublicClient } from "../supabase";

export default defineTool({
  name: "list_areas",
  title: "List areas",
  description:
    "List all areas (neighborhoods) that JaanNee dishes are tagged with. Returns slug plus English and Thai names.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = mcpPublicClient();
    const { data, error } = await supabase
      .from("areas")
      .select("slug, name_en, name_th")
      .order("name_en");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { areas: rows },
    };
  },
});