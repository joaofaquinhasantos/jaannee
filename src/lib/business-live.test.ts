import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AI_TRANSLATION_ENABLED,
  BUSINESS_OUTREACH_ENABLED,
  RESTAURANT_BILLING_ENABLED,
  businessMenuUrl,
  effectiveBusinessPlan,
  hasBusinessFeature,
} from "./business-entitlements";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261109081000_restaurant_free_onboarding_menu.sql", import.meta.url),
  "utf8",
);
const lockdown = readFileSync(
  new URL("../../supabase/migrations/20261109081500_hide_unreviewed_restaurant_submissions.sql", import.meta.url),
  "utf8",
);
const server = readFileSync(new URL("./business-live.functions.ts", import.meta.url), "utf8");
const ownerUi = readFileSync(new URL("../routes/_authenticated/business.tsx", import.meta.url), "utf8");
const publicUi = readFileSync(new URL("../routes/menu.$slug.tsx", import.meta.url), "utf8");
const adminUi = readFileSync(new URL("../routes/_authenticated/business-reviews.tsx", import.meta.url), "utf8");

describe("business onboarding security and data integrity", () => {
  it("exposes no secret or direct browser writes to restaurant drafts and menus", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.restaurant_businesses");
    expect(migration).toContain("REVOKE ALL ON TABLE public.restaurant_menu_entries");
    expect(migration).toContain("GRANT SELECT ON public.restaurant_businesses TO authenticated");
    expect(migration).not.toContain("GRANT INSERT ON public.restaurant_businesses TO authenticated");
    expect(migration).toContain("owner_id = (select auth.uid())");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.admin_review_business_draft(uuid,uuid,boolean,text)");
    expect(migration).toContain("TO service_role");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION public.admin_review_business_draft(uuid,uuid,boolean,text)\n  TO authenticated");
  });

  it("requires verified ownership and publishing before a public menu can be returned", () => {
    expect(migration).toContain("business_publication_requires_verification");
    expect(server).toContain('.eq("review_status", "verified")');
    expect(server).toContain('.not("published_at", "is", null)');
    expect(server).toContain('.eq("available", true)');
    expect(server).toContain('if (business.review_status !== "verified" || !business.verified_place_id)');
    expect(server).toContain('if (!items.data?.length)');
    expect(publicUi).toContain('createFileRoute("/menu/$slug")');
    expect(publicUi).toContain("English fallback");
    expect(publicUi).toContain("Menu temporarily unavailable");
    expect(publicUi).toContain("unavailable: true");
  });

  it("keeps reviewer approval restricted to DB-authenticated administrators", () => {
    expect(migration).toContain("public.has_role(_reviewer_id, 'admin'::public.app_role)");
    expect(migration).toContain("Only submitted businesses can be reviewed");
    expect(server).toContain('.from("user_roles")');
    expect(server).toContain('.eq("role", "admin")');
    expect(server).toContain('admin_review_business_draft');
    expect(adminUi).toContain('reviewBusinessSubmission');
  });

  it("removes public read and public self-approval for pending restaurants", () => {
    expect(lockdown).toContain('ALTER POLICY "places_select_published"');
    expect(lockdown).toContain("USING (status = 'approved')");
    expect(lockdown).toContain('ALTER POLICY "places auth insert"');
    expect(lockdown).toContain("status = 'pending'");
    expect(lockdown).toContain('ALTER POLICY "dishes public read published"');
  });

  it("calculates server-side entitlements and defaults unpaid/expired tiers to free", () => {
    expect(effectiveBusinessPlan({ plan_tier: "free", billing_status: "free", trial_ends_at: null })).toBe("free");
    expect(effectiveBusinessPlan({ plan_tier: "pro", billing_status: "past_due", trial_ends_at: null })).toBe("free");
    expect(effectiveBusinessPlan({ plan_tier: "growth", billing_status: "active", trial_ends_at: null })).toBe("growth");
    const trial = { plan_tier: "pro" as const, billing_status: "trialing" as const, trial_ends_at: "2026-11-20T00:00:00Z" };
    expect(effectiveBusinessPlan(trial, Date.parse("2026-11-19T00:00:00Z"))).toBe("pro");
    expect(effectiveBusinessPlan(trial, Date.parse("2026-11-21T00:00:00Z"))).toBe("free");
    expect(hasBusinessFeature({ plan_tier: "free", billing_status: "free", trial_ends_at: null }, "free_menu")).toBe(true);
    expect(hasBusinessFeature({ plan_tier: "free", billing_status: "free", trial_ends_at: null }, "ai_translation")).toBe(false);
    expect(hasBusinessFeature({ plan_tier: "pro", billing_status: "active", trial_ends_at: null }, "vouchers")).toBe(false);
    expect(hasBusinessFeature({ plan_tier: "growth", billing_status: "active", trial_ends_at: null }, "vouchers")).toBe(true);
    expect(AI_TRANSLATION_ENABLED).toBe(false);
    expect(RESTAURANT_BILLING_ENABLED).toBe(false);
    expect(BUSINESS_OUTREACH_ENABLED).toBe(false);
  });

  it("issues stable first-party QR menu destinations", () => {
    const url = businessMenuUrl("https://jaannee.example", "copper-basil-23ab");
    expect(url).toBe("https://jaannee.example/menu/copper-basil-23ab");
    expect(() => businessMenuUrl("javascript:alert(1)", "copper-basil-23ab")).toThrow();
    expect(() => businessMenuUrl("https://example.com", "../../bad")).toThrow();
  });

  it("exposes the real business journey only through an authenticated route", () => {
    expect(ownerUi).toContain('createFileRoute("/_authenticated/business")');
    expect(ownerUi).toContain("createBusinessDraft");
    expect(ownerUi).toContain("submitBusinessForReview");
    expect(ownerUi).toContain("upsertBusinessMenuItem");
    expect(ownerUi).toContain("setBusinessMenuPublished");
    expect(ownerUi).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/);
    expect(publicUi).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/);
  });
});
