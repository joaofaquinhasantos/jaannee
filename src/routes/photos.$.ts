import { createFileRoute } from "@tanstack/react-router";

// The bucket is private. Only images referenced by published content may be
// served anonymously; uploaded drafts, rejected dishes and deleted content
// must not become readable merely because their storage path is known.
const PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:jpg|png|webp)$/i;

async function isPublishedPhoto(path: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const url = `/photos/${path}`;
  const now = new Date().toISOString();
  const results = await Promise.all([
    admin.from("dishes").select("id").eq("photo_url", url).eq("status", "approved").limit(1),
    admin.from("categories").select("id").eq("image_url", url).limit(1),
    admin.from("categories").select("id").eq("reference_photo_url", url).limit(1),
    admin.from("profiles").select("id").eq("avatar_url", url).not("username", "is", null).limit(1),
    admin.from("restaurant_profiles").select("place_id").eq("is_verified", true).eq("logo_url", url).limit(1),
    admin.from("restaurant_profiles").select("place_id").eq("is_verified", true).eq("cover_url", url).limit(1),
    admin.from("restaurant_gallery_photos").select("place_id").eq("photo_url", url).limit(1),
    admin.from("restaurant_updates").select("place_id").eq("photo_url", url)
      .eq("is_active", true).lte("published_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`).limit(1),
  ]);
  for (const result of results) {
    if (result.error) throw new Error("Unable to verify photo publication status.");
  }
  if (results.slice(0, 6).some((result) => (result.data?.length ?? 0) > 0)) return true;
  const restaurantIds = [...new Set([
    ...(results[6].data ?? []).map((row: { place_id: string }) => row.place_id),
    ...(results[7].data ?? []).map((row: { place_id: string }) => row.place_id),
  ])];
  if (!restaurantIds.length) return false;
  const verified = await admin.from("restaurant_profiles").select("place_id")
    .eq("is_verified", true).in("place_id", restaurantIds).limit(1);
  if (verified.error) throw new Error("Unable to verify restaurant publication status.");
  return (verified.data?.length ?? 0) > 0;
}

export const Route = createFileRoute("/photos/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!PHOTO_PATH.test(path)) return new Response("Bad request", { status: 400 });
        if (!(await isPublishedPhoto(path))) {
          return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("dish-photos").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
        if (!allowed.has(data.type)) return new Response("Unsupported media type", { status: 415 });
        return new Response(data, {
          status: 200,
          headers: {
            "content-type": data.type,
            // Short cache: moderation, revocation and deletion must take effect.
            "cache-control": "public, max-age=300",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
