import { defineMcp } from "@lovable.dev/mcp-js";
import listCategories from "./tools/list-categories";
import listAreas from "./tools/list-areas";
import listDishes from "./tools/list-dishes";
import getDish from "./tools/get-dish";
import leaderboard from "./tools/leaderboard";

export default defineMcp({
  name: "jaannee-mcp",
  title: "JaanNee",
  version: "0.1.0",
  instructions:
    "Public read-only tools for JaanNee (จานนี้), a Thailand dish-ranking platform. Browse categories and areas, list approved dishes, look up a single dish by id, and read the Elo-ranked leaderboard per category/area. No authentication is required and no user data is exposed.",
  tools: [listCategories, listAreas, listDishes, getDish, leaderboard],
});