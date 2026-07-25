import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ToolContext } from "@lovable.dev/mcp-js";

// Supabase client for MCP tools. Uses the publishable key + the caller's
// verified OAuth bearer token so RLS runs as the signed-in JaanNee user.
// Never uses the service role.
export function mcpUserClient(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const token = ctx.getToken();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const DISH_SELECT = `
  id, name_en, name_th, price_thb, photo_url, note, elo, comparisons_count,
  category:categories(slug, name_en, name_th),
  subtype:dish_subtypes(slug, name_en, name_th, is_active),
  place:places!inner(name, address, lat, lng, area:areas(slug, name_en, name_th))
`;

export const DISH_SELECT_INNER = DISH_SELECT;

const DISH_SELECT_OUTER = `
  id, name_en, name_th, price_thb, photo_url, note, elo, comparisons_count,
  category:categories(slug, name_en, name_th),
  subtype:dish_subtypes(slug, name_en, name_th, is_active),
  place:places(name, address, lat, lng, area:areas(slug, name_en, name_th))
`;

export function dishSelect(withInnerPlace: boolean) {
  return withInnerPlace ? DISH_SELECT_INNER : DISH_SELECT_OUTER;
}