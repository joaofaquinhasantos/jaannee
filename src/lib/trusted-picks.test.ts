import { describe, expect, it } from "vitest";
import { groupFollowingPicks } from "./pick-display";
import type { PublicPick } from "./recommendations.functions";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20261109030000_explicit_diner_recommendations.sql", import.meta.url),
  "utf8",
);

function sample(userId: string, dishId: string, createdAt: string, note = ""): PublicPick {
  return {
    user_id: userId,
    dish_id: dishId,
    note,
    created_at: createdAt,
    dish: { id: dishId, name_en: "Pad Thai", status: "approved" },
    profile: { username: userId },
  };
}

describe("trusted food recommendations", () => {
  it("requires deliberately selected picks rather than treating tried marks as endorsements", () => {
    expect(sql).toContain("CREATE TABLE public.dish_recommendations");
    expect(sql).toContain("FOREIGN KEY (user_id, dish_id)");
    expect(sql).toContain("REFERENCES public.dish_tries(user_id, dish_id) ON DELETE CASCADE");
    expect(sql).toContain("AND d.status = 'approved'");
    expect(sql).toContain("p.username IS NOT NULL");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).not.toContain("UPDATE public.dishes SET elo");
  });

  it("shows only approved picks and does not double-count the same endorser", () => {
    const picks = [
      sample("alice", "dish-a", "2026-11-01T00:00:00Z", "Great noodles"),
      sample("alice", "dish-a", "2026-11-02T00:00:00Z", "Great noodles"),
      sample("bob", "dish-a", "2026-11-03T00:00:00Z"),
      sample("alice", "dish-b", "2026-11-04T00:00:00Z"),
      { ...sample("other", "dish-c", "2026-11-05T00:00:00Z"), dish: { id: "dish-c", name_en: "Unpublished", status: "pending" } },
    ];
    const groups = groupFollowingPicks(picks);
    expect(groups.map((p) => p.dish.id)).toEqual(["dish-a", "dish-b"]);
    expect(groups[0].supporters.map((p) => p.user_id)).toEqual(["alice", "bob"]);
    expect(groups[0].mostRecent).toBe("2026-11-03T00:00:00Z");
  });

  it("uses the explicit pick source and never turns follow activity into a recommendation", () => {
    const reader = readFileSync(new URL("../components/TrustedPicks.tsx", import.meta.url), "utf8");
    expect(reader).toContain("listFollowingPicks");
    expect(reader).not.toContain("listFollowingActivityFeed");
    const server = readFileSync(new URL("./recommendations.functions.ts", import.meta.url), "utf8");
    expect(server).toContain('from("dish_recommendations")');
    expect(server).not.toContain("submitComparison");
  });
});
