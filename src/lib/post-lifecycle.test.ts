import { describe, expect, it } from "vitest";
import {
  buildPostInbox,
  comparisonsUntilRank,
  postInboxItem,
  postMilestones,
} from "@/lib/post-lifecycle";

describe("post lifecycle", () => {
  it("shows the next meaningful milestone without inventing rank", () => {
    const stages = postMilestones({
      id: "dish",
      status: "approved",
      tried_count: 2,
      comparisons_count: 1,
    });

    expect(stages.map((stage) => [stage.key, stage.complete, stage.current])).toEqual([
      ["live", true, false],
      ["reviewed", true, false],
      ["tried", true, false],
      ["compared", true, false],
      ["ranked", false, true],
    ]);
  });

  it("uses the public threshold for remaining comparisons", () => {
    expect(comparisonsUntilRank({ id: "dish", comparisons_count: 4 })).toBe(1);
    expect(comparisonsUntilRank({ id: "dish", comparisons_count: 5 })).toBe(0);
  });

  it("prioritizes meaningful progress over a newly posted item", () => {
    const items = buildPostInbox([
      { id: "new", status: "pending", comparisons_count: 0, created_at: "2026-07-28" },
      { id: "almost", status: "approved", comparisons_count: 4, created_at: "2026-07-01" },
      { id: "ranked", status: "approved", comparisons_count: 5, created_at: "2026-06-01" },
    ]);

    expect(items.map((item) => item.dish.id)).toEqual(["ranked", "almost", "new"]);
    expect(postInboxItem(items[0].dish).kind).toBe("ranked");
  });
});
