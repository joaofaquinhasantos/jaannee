import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { challengeUrl } from "./share-card";

const sql = readFileSync(
  new URL("../../supabase/manual/20260728_retention_suite.sql", import.meta.url),
  "utf8",
);

describe("retention suite", () => {
  it("keeps private retention tables protected by RLS", () => {
    for (const table of [
      "user_notifications",
      "challenge_responses",
      "user_retention_preferences",
      "dish_collections",
      "dish_collection_items",
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toMatch(/revoke all[\s\S]+from public, anon/i);
  });

  it("keeps collections and preferences diner-owned", () => {
    expect(sql).toContain("auth.uid() = user_id");
    expect(sql).toContain("c.user_id = auth.uid()");
  });

  it("attributes challenge links only when a challenger is supplied", () => {
    const base = "https://jaannee.test";
    expect(challengeUrl(base, "winner", "loser")).toBe(
      `${base}/challenge/winner/loser?pick=winner`,
    );
    expect(challengeUrl(base, "winner", "loser", "user-1")).toBe(
      `${base}/challenge/winner/loser?pick=winner&from=user-1`,
    );
  });
});
