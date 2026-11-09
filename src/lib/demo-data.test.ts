import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  demoAreas, demoCategories, demoDishes, demoPeople, demoRestaurants,
  filterDemoDishes, rankDemoDishes, restaurantFor,
} from "./demo-data";

describe("isolated development demo", () => {
  it("contains 40 distinct, fully linked fictional dish entries", () => {
    expect(demoDishes).toHaveLength(40);
    expect(new Set(demoDishes.map((dish) => dish.id)).size).toBe(40);
    expect(demoRestaurants).toHaveLength(10);
    expect(new Set(demoRestaurants.map((place) => place.id)).size).toBe(10);
    expect(demoPeople).toHaveLength(6);
    expect(new Set(demoPeople.map((person) => person.username)).size).toBe(6);
    for (const dish of demoDishes) {
      expect(restaurantFor(dish)?.id).toBe(dish.restaurantId);
      expect(demoCategories).toContain(dish.category);
      expect(demoAreas).toContain(restaurantFor(dish).area);
      expect(dish.price).toBeGreaterThan(0);
      expect(dish.image).toContain("images.unsplash.com/");
      expect(dish.comparisons).toBeGreaterThan(0);
    }
    for (const person of demoPeople) {
      for (const pick of person.picks) {
        expect(demoDishes.some((dish) => dish.id === pick.dishId)).toBe(true);
        expect(pick.note).toBeTruthy();
      }
    }
  });

  it("supports area, dish and place searches without any network queries", () => {
    const category = filterDemoDishes(demoDishes, { category: "Pad Kra Pao" });
    expect(category).toHaveLength(4);
    expect(category.every((dish) => dish.category === "Pad Kra Pao")).toBe(true);
    const byArea = filterDemoDishes(demoDishes, { area: "Ari" });
    expect(byArea.length).toBeGreaterThan(0);
    expect(byArea.every((dish) => restaurantFor(dish).area === "Ari")).toBe(true);
    expect(filterDemoDishes(demoDishes, { query: "khao soi" }).length).toBeGreaterThan(0);
    expect(filterDemoDishes(demoDishes, { query: "Golden Wok" }).length).toBeGreaterThan(0);
    expect(filterDemoDishes(demoDishes, { query: "impossible dish xyz" })).toEqual([]);
  });

  it("sorts demonstration results deterministically without changing the source list", () => {
    const original = demoDishes.map((dish) => dish.id);
    expect(rankDemoDishes(demoDishes)).toEqual(rankDemoDishes(demoDishes));
    expect(demoDishes.map((dish) => dish.id)).toEqual(original);
    expect(rankDemoDishes(demoDishes)[0].score).toBeGreaterThanOrEqual(
      rankDemoDishes(demoDishes).at(-1)!.score,
    );
  });

  it("keeps the navigable demo separate from real account and server functions", () => {
    const route = readFileSync(new URL("../routes/demo.tsx", import.meta.url), "utf8");
    const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
    const data = readFileSync(new URL("./demo-data.ts", import.meta.url), "utf8");
    expect(route).toContain('createFileRoute("/demo")');
    expect(route).toContain('"noindex, nofollow, noarchive"');
    expect(route).toContain("DEMO_DISCLAIMER");
    expect(route).not.toMatch(/createServerFn|supabase\.|from\("dishes"\)|fetch\(/);
    expect(root).toContain('pathname === "/demo" || pathname === "/demo-business"');
    expect(data).not.toMatch(/createServerFn|supabase\.|fetch\(/);
  });
});
