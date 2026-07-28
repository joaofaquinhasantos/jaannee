import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("atomic comparison contract", () => {
  it("routes the application write through the atomic RPC only", () => {
    const source = read("src/lib/dishes.functions.ts");
    const submitBlock = source.slice(
      source.indexOf("export const submitComparison"),
      source.indexOf("export const myProfile"),
    );

    expect(submitBlock).toContain('rpc("submit_comparison_atomic"');
    expect(submitBlock).not.toMatch(/\.from\(["']comparisons["']\)\s*\.insert/);
    expect(submitBlock).not.toMatch(/\.from\(["']comparisons["']\)\s*\.update/);
    expect(submitBlock).not.toMatch(/\.from\(["']comparisons["']\)\s*\.delete/);
    expect(submitBlock).not.toContain('rpc("apply_elo"');
  });

  it("keeps the manual database installation atomic and immutable", () => {
    const sql = read("supabase/manual/20260727_atomic_immutable_comparisons.sql");

    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain("CREATE UNIQUE INDEX comparisons_user_pair_unique");
    expect(sql).toContain("CREATE TRIGGER trg_comparisons_immutable");
    expect(sql).toContain("CREATE TRIGGER trg_comparisons_apply_elo");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.submit_comparison_atomic");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("TO service_role");
    expect(sql).toContain(
      "DROP FUNCTION IF EXISTS public.apply_elo(uuid, uuid, uuid, uuid, boolean)",
    );
  });
});
