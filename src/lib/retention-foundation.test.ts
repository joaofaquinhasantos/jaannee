import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../supabase/manual/20260728_retention_foundation.sql", import.meta.url),
  "utf8",
);

describe("retention foundation database contract", () => {
  it("keeps saved dishes private and diner-owned", () => {
    expect(sql).toContain("alter table public.dish_wants enable row level security");
    expect(sql).toContain('create policy "dish wants owner read"');
    expect(sql).toContain("auth.uid() = user_id");
    expect(sql).toContain("revoke all on table public.dish_wants from public, anon");
  });

  it("accepts only approved dishes", () => {
    expect(sql).toContain('create policy "dish wants owner insert approved"');
    expect(sql).toContain("d.status = 'approved'");
  });

  it("converts a saved dish to tried without affecting ranking data", () => {
    expect(sql).toContain("create trigger trg_clear_dish_want_after_try");
    expect(sql).toContain("delete from public.dish_wants");
    expect(sql).not.toContain("update public.dishes");
    expect(sql).not.toContain("insert into public.comparisons");
  });
});
