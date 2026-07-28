import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../supabase/manual/20260728_interest_follows.sql", import.meta.url),
  "utf8",
);

describe("interest follow database contract", () => {
  it("keeps category and area follows private and diner-owned", () => {
    expect(sql).toContain("alter table public.category_follows enable row level security");
    expect(sql).toContain("alter table public.area_follows enable row level security");
    expect(sql).toContain("auth.uid() = user_id");
    expect(sql).toContain("revoke all on table public.category_follows from public, anon");
    expect(sql).toContain("revoke all on table public.area_follows from public, anon");
  });

  it("does not grant updates or broad public access", () => {
    expect(sql).toContain("grant select, insert, delete");
    expect(sql).not.toContain("grant all");
    expect(sql).not.toContain("to public");
  });
});
