import { describe, expect, it } from "vitest";
import { dishStatusLabel } from "@/lib/dish-status";

const t = (key: string) => key;

describe("dish ranking status", () => {
  it("keeps dishes below five comparisons unranked", () => {
    expect(dishStatusLabel({ comparisons_count: 4, elo: 1500 }, t).text).toBe("status_gathering");
  });

  it("labels every dish at or above the threshold as ranked", () => {
    expect(dishStatusLabel({ comparisons_count: 5, elo: 900 }, t).text).toBe("status_ranked");
    expect(dishStatusLabel({ comparisons_count: 5, elo: 1200 }, t).text).toBe("status_top");
  });
});
