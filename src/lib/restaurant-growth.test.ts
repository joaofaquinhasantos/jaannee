import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { signLoyaltyToken,verifyLoyaltyToken } from "./loyalty-tokens.server";

const migration=readFileSync(new URL("../../supabase/migrations/20261109091000_restaurant_growth_loyalty_followers.sql",import.meta.url),"utf8");
const follow=readFileSync(new URL("./restaurant-growth.functions.ts",import.meta.url),"utf8");
const loyalty=readFileSync(new URL("./restaurant-loyalty.functions.ts",import.meta.url),"utf8");
const dinerUi=readFileSync(new URL("../components/PublicRestaurantGrowth.tsx",import.meta.url),"utf8");
const ownerUi=readFileSync(new URL("../components/BusinessGrowthPanel.tsx",import.meta.url),"utf8");

const ids={
  businessId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  programId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  userId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
};
describe("restaurant follows, vouchers and staff-verified loyalty",()=>{
  it("uses separate default-off voucher/message consent without public writes",()=>{
    expect(migration).toContain("allow_vouchers boolean NOT NULL DEFAULT false");
    expect(migration).toContain("allow_messages boolean NOT NULL DEFAULT false");
    expect(migration).toContain("CREATE POLICY");
    expect(migration).toContain("diner views own restaurant follows");
    expect(migration).toContain("REVOKE ALL ON public.restaurant_followers FROM PUBLIC,anon,authenticated");
    expect(follow).toContain("allowVouchers:z.boolean().default(false)");
    expect(follow).toContain("allowMessages:z.boolean().default(false)");
    expect(follow).toContain(".eq(\"allow_vouchers\",true)");
    expect(dinerUi).toContain("Unfollow and withdraw consent");
  });

  it("keeps restaurant promotions distinct from diner rankings and sponsored boosts",()=>{
    expect(migration).toContain("kind IN ('promotion','voucher')");
    expect(migration).toContain("campaign_end_after_start");
    expect(migration).toContain("voucher_discount_required");
    expect(follow).toContain(".eq(\"kind\",\"promotion\")");
    expect(follow).toContain(".eq(\"kind\",\"voucher\")");
    expect(follow).toContain("Maximum three active campaigns per outlet");
    expect(ownerUi).toContain("Sponsored placements");
    expect(ownerUi).toContain("No followers are contacted.");
  });

  it("issues only opted-in, single-use vouchers with owner-side redemption",()=>{
    expect(migration).toContain("UNIQUE(campaign_id,user_id)");
    expect(migration).toContain("claim_code text NOT NULL UNIQUE");
    expect(migration).toContain("voucher_redemption_before_expiry");
    expect(follow).toContain(".eq(\"user_id\",context.userId).eq(\"allow_vouchers\",true)");
    expect(follow).toContain('.is("redeemed_at",null)');
    expect(follow).toContain('.gt("expires_at",new Date().toISOString())');
    expect(follow).toContain("Voucher does not belong to this restaurant.");
  });

  it("creates signed short-lived per-diner, per-venue guest proof",()=>{
    const secret="temporary_test_secret_of_very_long_length_12345";
    const now=1_800_000_000_000;
    const token=signLoyaltyToken({...ids,action:"visit"},secret,now);
    const payload=verifyLoyaltyToken(token,secret,now);
    expect(payload.userId).toBe(ids.userId);
    expect(payload.businessId).toBe(ids.businessId);
    expect(payload.programId).toBe(ids.programId);
    expect(payload.action).toBe("visit");
    expect(()=>verifyLoyaltyToken(token,secret,now+301_000)).toThrow("expired");
    expect(()=>verifyLoyaltyToken(token,secret+"x",now)).toThrow("signature");
    expect(()=>verifyLoyaltyToken(token.slice(0,-5)+"abcde",secret,now)).toThrow();
    expect(()=>signLoyaltyToken({...ids,action:"visit"},"short",now)).toThrow("long secret");
  });

  it("requires staff authorization, visit cooldown and reward-ready state",()=>{
    expect(migration).toContain("public.apply_restaurant_loyalty_action");
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("20 hours");
    expect(migration).toContain("IF NOT card.reward_ready");
    expect(migration).toContain("Reward is ready for redemption");
    expect(loyalty).toContain("requireGrowthOwner");
    expect(loyalty).toContain("loyaltySecret()");
    expect(loyalty).toContain("proof.businessId!==data.businessId");
    expect(loyalty).toContain('service.rpc("apply_restaurant_loyalty_action"');
  });

  it("requires active Growth for promotions, offers and loyalty",()=>{
    expect(follow).toContain('hasBusinessFeature(b,"loyalty")');
    expect(loyalty).toContain('hasBusinessFeature(b.data,"loyalty")');
    expect(loyalty).toContain("Verified Growth restaurant ownership required.");
    expect(migration).toContain("business.plan_tier<>'growth'");
    expect(migration).toContain("business.review_status<>'verified'");
  });
});
