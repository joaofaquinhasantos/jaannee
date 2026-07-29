import { createFileRoute } from "@tanstack/react-router";
import { RestaurantProfileView } from "@/routes/place.$placeId";
import { demoRestaurantProfile } from "@/lib/restaurant-demo";

export const Route = createFileRoute("/restaurant-demo")({
  head: () => ({
    meta: [
      { title: "Demo restaurant profile — JaanNee" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DemoRestaurantProfile,
});

function DemoRestaurantProfile() {
  return <RestaurantProfileView data={demoRestaurantProfile} />;
}
