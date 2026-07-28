import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("approved photo immutability contract", () => {
  it("removes public reads and owner updates, and protects approved references", () => {
    const sql = read("supabase/manual/20260727_approved_photo_immutability.sql");

    expect(sql).toContain('DROP POLICY IF EXISTS "dish photos public read"');
    expect(sql).toContain('DROP POLICY IF EXISTS "dish photos owner update"');
    expect(sql).toContain('CREATE POLICY "dish photos owner delete unapproved only"');
    expect(sql).toContain("d.status = 'approved'");
    expect(sql).toContain("d.photo_url = '/photos/' || storage.objects.name");
  });
});
