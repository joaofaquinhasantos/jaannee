import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dishSelect, mcpPublicClient } from "../supabase";

export default defineTool({
  name: "get_dish",
  title: "Get dish",
  description: "Get full details for one approved dish on JaanNee by its UUID.",
  inputSchema: {
    id: z.string().uuid().describe("Dish UUID (from list_dishes or leaderboard)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    const supabase = mcpPublicClient();
    const { data, error } = await supabase
      .from("dishes")
      .select(dishSelect(false))
      .eq("status", "approved")
      .not("category_id", "is", null)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: "Dish not found." }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { dish: data },
    };
  },
});