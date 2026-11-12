import { createFileRoute } from "@tanstack/react-router";
import { StitchSocialShell } from "@/components/StitchSocialShell";
import { StitchSocialNewsFeed } from "@/components/StitchSocialNewsFeed";
import { getDiscoverBootstrap } from "@/lib/dishes.functions";
import type { SocialDish } from "@/lib/stitch-social-feed";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const result = await getDiscoverBootstrap();
      return { ...result, temporarilyUnavailable: false };
    } catch {
      // The feed remains accessible during a Supabase outage.
      // Do not simulate recommendations, rankings, venues or user counts.
      return {
        dishes: [],
        categories: [],
        areas: [],
        temporarilyUnavailable: true,
      };
    }
  },
  head: () => ({
    meta: [
      { title: "Jaannee — Social food discovery in Bangkok" },
      {
        name: "description",
        content:
          "Discover real dishes, follow Bangkok food lovers, and share the plates you genuinely recommend.",
      },
      {
        property: "og:title",
        content: "Jaannee — Find your next favorite dish",
      },
    ],
  }),
  component: SocialHomePage,
});

function SocialHomePage() {
  const result = Route.useLoaderData();
  return <StitchSocialShell>
    {result.temporarilyUnavailable ? <div role="status"
      className="mx-auto max-w-6xl border-b px-4 py-3 text-xs"
      style={{background:"var(--ss-primary-soft)",color:"var(--ss-ink)",borderColor:"var(--ss-line)"}}>
      Jaannee discovery data is temporarily unavailable. No sample activity is being shown as real.
    </div> : null}
    <StitchSocialNewsFeed
      dishes={(result.dishes ?? []) as unknown as SocialDish[]}
      categories={(result.categories ?? []) as unknown as Array<{
        id:string;slug:string;name_en:string;name_th?:string|null;
      }>}
      areas={(result.areas ?? []) as unknown as Array<{
        id?:string;slug?:string;name_en?:string|null;name_th?:string|null;
      }>}
    />
  </StitchSocialShell>;
}
