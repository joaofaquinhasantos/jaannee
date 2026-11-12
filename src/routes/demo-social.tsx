import { createFileRoute } from "@tanstack/react-router";
import { DemoSocialPreview } from "@/components/DemoSocialPreview";

export const Route = createFileRoute("/demo-social")({
  head: () => ({
    meta: [
      { title: "Jaannee · Social UI preview · Fictional sample" },
      { name: "robots", content: "noindex,nofollow,noarchive" },
      { name: "description", content: "A fictional, database-independent preview of the responsive Jaannee social redesign." },
    ],
  }),
  component: DemoSocialPreview,
});
