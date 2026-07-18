import { createFileRoute } from "@tanstack/react-router";

// Public photo proxy: streams objects from the private `dish-photos`
// bucket using the service-role client. No auth required — Facebook /
// OG scrapers must be able to fetch these URLs anonymously.
export const Route = createFileRoute("/photos/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!path || path.includes("..")) {
          return new Response("Bad request", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("dish-photos")
          .download(path);
        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }
        const contentType = data.type || "application/octet-stream";
        return new Response(data, {
          status: 200,
          headers: {
            "content-type": contentType,
            "cache-control": "public, max-age=31536000, immutable",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});