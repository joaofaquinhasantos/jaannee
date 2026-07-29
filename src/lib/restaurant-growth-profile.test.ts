import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const sql = readFileSync(
  `${projectRoot}/supabase/manual/20260729_restaurant_growth_profile.sql`,
  "utf8",
).toLowerCase();

describe("restaurant Growth profile safety", () => {
  it("keeps gallery and update tables behind RLS", () => {
    expect(sql).toContain("alter table public.restaurant_gallery_photos enable row level security");
    expect(sql).toContain("alter table public.restaurant_updates enable row level security");
  });

  it("requires an active Growth plan or unexpired trial", () => {
    expect(sql).toContain("subscription_status = 'active'");
    expect(sql).toContain("subscription_status = 'trialing'");
    expect(sql).toContain("trial_ends_at > now()");
    expect(sql).toContain("trg_restaurant_outreach_growth");
    expect(sql).toContain('drop policy if exists "restaurant members read consented audience"');
    expect(sql).toContain("public.restaurant_growth_is_active(place_id)");
  });

  it("limits official updates and preserves ranking isolation", () => {
    expect(sql).toContain("interval '7 days'");
    expect(sql).toContain("up to two official updates every 7 days");
    expect(sql).not.toContain("update public.dishes");
    expect(sql).not.toContain("update public.comparisons");
    expect(sql).not.toContain("update public.dish_elo");
  });
});
