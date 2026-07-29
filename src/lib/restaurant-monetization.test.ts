import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const sql = readFileSync(
  `${projectRoot}/supabase/manual/20260729_restaurant_monetization.sql`,
  "utf8",
).toLowerCase();
const serverFunctions = readFileSync(
  `${projectRoot}/src/lib/restaurant.functions.ts`,
  "utf8",
).toLowerCase();

const restaurantTables = [
  "restaurant_claims",
  "restaurant_memberships",
  "restaurant_profiles",
  "restaurant_contact_permissions",
  "restaurant_outreach",
];

describe("restaurant monetization safety contract", () => {
  it("enables row-level security for every restaurant table", () => {
    for (const table of restaurantTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("requires explicit scoped permission and a current dish relationship", () => {
    expect(sql).toContain("permission_row.allow_messages");
    expect(sql).toContain("permission_row.allow_vouchers");
    expect(sql).toContain("from public.dish_tries");
    expect(sql).toContain("from public.dish_wants");
    expect(sql).toContain("d.place_id = new.place_id");
  });

  it("enforces contact frequency limits in the database", () => {
    expect(sql).toContain("interval '7 days'");
    expect(sql).toContain("interval '30 days'");
    expect(sql).toContain("only one restaurant message may be sent");
    expect(sql).toContain("only one gift voucher may be sent");
  });

  it("keeps claim approval service-role only", () => {
    expect(sql).toContain(
      "revoke all on function public.admin_review_restaurant_claim(uuid, boolean, uuid, text) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.admin_review_restaurant_claim(uuid, boolean, uuid, text) to service_role",
    );
  });

  it("does not expose ranking or comparison writes to restaurants", () => {
    expect(serverFunctions).not.toContain('.from("comparisons")');
    expect(serverFunctions).not.toContain('.from("dish_tries").insert');
    expect(serverFunctions).not.toContain('.from("dish_wants").insert');
    expect(serverFunctions).not.toContain("submitcomparison");
    expect(serverFunctions).not.toContain("apply_elo");
  });
});
