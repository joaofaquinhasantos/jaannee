export type BusinessPlan = "free" | "pro" | "growth";
export type BillingStatus = "free" | "trialing" | "active" | "past_due" | "canceled";
export type RestaurantFeature = "free_menu" | "ai_translation" | "custom_qr" | "analytics" | "promotions" | "vouchers" | "loyalty";

export type BusinessEntitlement = {
  plan_tier: BusinessPlan;
  billing_status: BillingStatus;
  trial_ends_at: string | null;
};

/**
 * Never accept plan claims from the browser. This function must be fed a
 * trusted DB row after server-side owner verification.
 */
export function effectiveBusinessPlan(row: BusinessEntitlement, now = Date.now()): BusinessPlan {
  if (row.plan_tier === "free" || row.billing_status === "free") return "free";
  if (row.billing_status === "active") return row.plan_tier;
  if (row.billing_status === "trialing" &&
      row.trial_ends_at &&
      Number.isFinite(Date.parse(row.trial_ends_at)) &&
      Date.parse(row.trial_ends_at) > now) {
    return row.plan_tier;
  }
  return "free";
}

export function hasBusinessFeature(
  row: BusinessEntitlement,
  feature: RestaurantFeature,
  now = Date.now(),
): boolean {
  if (feature === "free_menu") return true;
  const plan = effectiveBusinessPlan(row, now);
  if (plan === "free") return false;
  if (feature === "ai_translation" || feature === "custom_qr" || feature === "analytics") return true;
  return plan === "growth";
}

export function businessMenuUrl(origin: string, slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid restaurant slug");
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid menu origin");
  return new URL("/menu/" + slug, url).toString();
}

/** Paid AI features are intentionally disabled until the trusted billing lifecycle is ready. */
export const AI_TRANSLATION_ENABLED = false;
export const RESTAURANT_BILLING_ENABLED = false;
export const BUSINESS_OUTREACH_ENABLED = false;
