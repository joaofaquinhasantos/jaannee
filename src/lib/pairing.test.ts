import { describe, expect, it } from "vitest";
import { eligiblePartnersFor, findEligiblePairs, isSamePool, pairKey, poolKey } from "@/lib/pairing";

const category = { id: "cat-1", requires_subtype: true };
const subtypeA = { id: "sub-a", is_active: true };
const subtypeB = { id: "sub-b", is_active: true };

const dish = (id: string, subtype = subtypeA, status = "approved") => ({
  id,
  status,
  category,
  subtype_id: subtype.id,
  subtype,
});

describe("comparison ranking pools", () => {
  it("keeps comparisons inside the exact same active subtype", () => {
    expect(isSamePool(dish("a"), dish("b"))).toBe(true);
    expect(isSamePool(dish("a"), dish("b", subtypeB))).toBe(false);
  });

  it("rejects unapproved and inactive-subtype dishes", () => {
    expect(poolKey(dish("a", subtypeA, "pending"))).toBeNull();
    expect(poolKey(dish("a", { id: "sub-a", is_active: false }))).toBeNull();
  });

  it("excludes completed pairs without depending on dish order", () => {
    const dishes = [dish("b"), dish("a"), dish("c")];
    const completed = [pairKey("a", "b")];
    const pairs = findEligiblePairs(dishes, completed);
    expect(pairs.map((pair) => pairKey(pair.a.id, pair.b.id))).toEqual([
      pairKey("a", "c"),
      pairKey("b", "c"),
    ]);
  });

  it("returns only eligible uncompleted partners for a selected dish", () => {
    const dishes = [dish("a"), dish("b"), dish("c"), dish("x", subtypeB)];
    expect(eligiblePartnersFor("a", dishes, [pairKey("a", "b")]).map((item) => item.id)).toEqual([
      "c",
    ]);
  });
});
