import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCategories from "./tools/list-categories";
import listAreas from "./tools/list-areas";
import listDishes from "./tools/list-dishes";
import getDish from "./tools/get-dish";
import leaderboard from "./tools/leaderboard";

// Direct Supabase host — the .lovable.cloud proxy URL is rejected by the
// OAuth discovery check on published builds.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "jaannee-mcp",
  title: "JaanNee",
  version: "0.1.0",
  instructions:
    "Read-only tools for JaanNee (จานนี้), a Thailand dish-ranking platform. Callers sign in as a JaanNee user; queries run under that user's Supabase RLS. Browse categories and areas, list approved dishes, look up a single dish by id, and read the Elo-ranked leaderboard per category/area.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCategories, listAreas, listDishes, getDish, leaderboard],
});