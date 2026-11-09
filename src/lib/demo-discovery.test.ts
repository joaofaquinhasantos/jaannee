import { describe, expect, it } from "vitest";
import { canCompareDemoDishes, countTrustedDemoPicks, discoverTrustedDemoDishes } from "./demo-discovery";
import { demoDishes, demoPeople, type DemoDish, type DemoPerson } from "./demo-data";

describe("demo social discovery", () => {
  it("counts deliberate endorsements from followed diners only", () => {
    const nina = demoPeople.find((person) => person.username === "nina_eats")!;
    const ton = demoPeople.find((person) => person.username === "ton_tastes")!;
    const chosen = new Set([nina.username, ton.username]);
    const counts = countTrustedDemoPicks(demoPeople, chosen);
    expect(counts.size).toBeGreaterThan(0);
    expect(counts.get("khao-soi-chicken")).toBe(1);
    expect(counts.get("fire-basil-pork")).toBe(1);
    expect(counts.get("classic-mango-rice") ?? 0).toBe(0);
  });

  it("deduplicates picks from the same diner and orders trusted dishes independently of scores", () => {
    const person: DemoPerson = {
      username: "demo",
      name: "Demo",
      initials: "D",
      bio: "",
      color: "#333",
      picks: [
        { dishId: "fire-basil-pork", note: "One" },
        { dishId: "fire-basil-pork", note: "Duplicate" },
        { dishId: "classic-mango-rice", note: "Favorite" },
      ],
    };
    const second: DemoPerson = {
      ...person,
      username: "second",
      picks: [{ dishId: "classic-mango-rice", note: "Another vote" }],
    };
    const counts = countTrustedDemoPicks([person, second], new Set(["demo", "second"]));
    expect(counts.get("fire-basil-pork")).toBe(1);
    expect(counts.get("classic-mango-rice")).toBe(2);
    const ranked = discoverTrustedDemoDishes(demoDishes, counts);
    expect(ranked[0].id).toBe("classic-mango-rice");
    expect(ranked).toHaveLength(2);
  });

  it("requires two different dishes in the same category and both tried marks before comparison", () => {
    const first = demoDishes.find((dish) => dish.id === "fire-basil-pork")!;
    const sameType = demoDishes.find((dish) => dish.id === "beef-basil-crunch")!;
    const otherType = demoDishes.find((dish) => dish.id === "khao-soi-chicken")!;
    expect(canCompareDemoDishes(first, sameType, new Set())).toBe(false);
    expect(canCompareDemoDishes(first, sameType, new Set([first.id]))).toBe(false);
    expect(canCompareDemoDishes(first, sameType, new Set([first.id, sameType.id]))).toBe(true);
    expect(canCompareDemoDishes(first, otherType, new Set([first.id, otherType.id]))).toBe(false);
    expect(canCompareDemoDishes(first, first, new Set([first.id]))).toBe(false);
  });

  it("does not mutate original dishes, picks, or sample leaderboard scores", () => {
    const snapshots = demoDishes.map(({ id, score, comparisons }) => ({ id, score, comparisons }));
    const counts = countTrustedDemoPicks(demoPeople, new Set(["nina_eats", "ton_tastes"]));
    discoverTrustedDemoDishes(demoDishes, counts);
    expect(demoDishes.map(({ id, score, comparisons }) => ({ id, score, comparisons }))).toEqual(snapshots);
  });
});
