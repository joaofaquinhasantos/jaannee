import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Anon/public Supabase client for MCP tools. Uses the publishable key only —
// never the service role — so RLS applies as `anon` and only intentionally
// public data is reachable.
export function mcpPublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
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