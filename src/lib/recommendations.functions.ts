import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// A recommendation is a deliberate, public positive endorsement. A tried
// marker, dish post, follow, or ranking comparison must never create one.
export type PublicPick = {
  user_id: string;
  dish_id: string;
  note: string;
  created_at: string;
  dish: {
    id: string;
    name_en: string;
    name_th?: string | null;
    photo_url?: string | null;
    status?: string | null;
    place?: { name?: string | null } | null;
    category?: { name_en?: string | null; name_th?: string | null } | null;
  };
  profile: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
};

const selectPicks = `
  user_id, dish_id, note, created_at,
  dish:dishes!inner(id, name_en, name_th, photo_url, status,
    place:places(name), category:categories(name_en, name_th)),
  profile:profiles!inner(username, display_name, avatar_url)
`;

function normalizePicks(rows: unknown): PublicPick[] {
  return ((rows ?? []) as PublicPick[]).filter(
    (row) => row.dish?.id && row.dish.status === "approved" && row.profile?.username?.trim(),
  );
}

function publicReader() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public connection is not configured.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const myDishRecommendation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dishId: string }) =>
    z.object({ dishId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("dish_recommendations")
      .select("dish_id, note, created_at")
      .eq("user_id", context.userId)
      .eq("dish_id", data.dishId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as { dish_id: string; note: string; created_at: string } | null;
  });

export const setDishRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dishId: string; recommended: boolean; note?: string }) =>
    z.object({
      dishId: z.string().uuid(),
      recommended: z.boolean(),
      note: z.string().trim().max(180).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as any;
    if (!data.recommended) {
      const { error } = await db.from("dish_recommendations")
        .delete().eq("user_id", context.userId).eq("dish_id", data.dishId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const [dishResult, triedResult, profileResult] = await Promise.all([
      db.from("dishes").select("id").eq("id", data.dishId)
        .eq("status", "approved").maybeSingle(),
      db.from("dish_tries").select("dish_id").eq("user_id", context.userId)
        .eq("dish_id", data.dishId).maybeSingle(),
      db.from("profiles").select("username").eq("id", context.userId).maybeSingle(),
    ]);
    for (const result of [dishResult, triedResult, profileResult]) {
      if (result.error) throw new Error(result.error.message);
    }
    if (!dishResult.data) throw new Error("Only approved dishes can be recommended.");
    if (!triedResult.data) throw new Error("Mark this dish as tried before recommending it.");
    if (!profileResult.data?.username?.trim()) {
      throw new Error("Set a public username in your profile before sharing recommendations.");
    }
    const { error } = await db.from("dish_recommendations")
      .upsert({
        user_id: context.userId,
        dish_id: data.dishId,
        note: data.note ?? "",
      }, { onConflict: "user_id,dish_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public list for shareable diner profiles; no private tried history is exposed. */
export const listPublicPicks = createServerFn({ method: "GET" })
  .inputValidator((input: { username: string }) =>
    z.object({
      username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = publicReader() as any;
    const { data: profile, error: profileError } = await db
      .from("profiles").select("id").ilike("username", data.username).maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) return [];
    const result = await db.from("dish_recommendations").select(selectPicks)
      .eq("user_id", profile.id).eq("dish.status", "approved")
      .order("created_at", { ascending: false }).limit(60);
    if (result.error) throw new Error(result.error.message);
    return normalizePicks(result.data);
  });

/** Only explicit picks from profiles the current diner follows, never implied likes. */
export const listFollowingPicks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dishId?: string } | undefined) =>
    z.object({ dishId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as any;
    const { data: follows, error: followError } = await db.from("follows")
      .select("following_id").eq("follower_id", context.userId).limit(150);
    if (followError) throw new Error(followError.message);
    const ids: string[] = (follows ?? []).map((f: { following_id: string }) => f.following_id);
    if (!ids.length) return [];
    let query = db.from("dish_recommendations").select(selectPicks)
      .in("user_id", ids).eq("dish.status", "approved")
      .order("created_at", { ascending: false }).limit(data.dishId ? 80 : 120);
    if (data.dishId) query = query.eq("dish_id", data.dishId);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return normalizePicks(result.data);
  });
