import { describe, expect, it } from "vitest";
import {
  buildComparisonCard,
  buildFoodPostCard,
  buildRankingCard,
  challengeUrl,
  shareText,
} from "@/lib/share-card";

const dish = {
  id: "11111111-1111-4111-8111-111111111111",
  name_en: "Boat noodles",
  name_th: "ก๋วยเตี๋ยวเรือ",
  comparisons_count: 5,
  place: { name: "Victory Monument Stall" },
  category: { name_en: "Noodles", name_th: "ก๋วยเตี๋ยว" },
  subtype: { name_en: "Boat noodles", name_th: "ก๋วยเตี๋ยวเรือ" },
};

const other = {
  ...dish,
  id: "22222222-2222-4222-8222-222222222222",
  name_en: "Boat noodles B",
  name_th: "ก๋วยเตี๋ยวเรือ บี",
  place: { name: "Ari Noodle Shop" },
};

describe("share-card models", () => {
  it("never creates a numeric ranking card below the public threshold", () => {
    expect(
      buildRankingCard({ lang: "en", dish: { ...dish, comparisons_count: 4 }, rank: 1, url: "/" }),
    ).toBeNull();
  });

  it("creates a real ranked card at the threshold", () => {
    const model = buildRankingCard({ lang: "th", dish, rank: 2, url: "/dish/1" });
    expect(model?.rank).toBe(2);
    expect(model?.dishName).toBe("ก๋วยเตี๋ยวเรือ");
    expect(model?.comparisons).toBe(5);
  });

  it("builds the challenge URL from the actual selected winner", () => {
    expect(challengeUrl("https://jaannee.app/", dish.id, other.id)).toBe(
      `https://jaannee.app/challenge/${dish.id}/${other.id}?pick=${dish.id}`,
    );
  });

  it("creates bilingual comparison copy from real dish data", () => {
    const model = buildComparisonCard({
      lang: "en",
      winner: dish,
      loser: other,
      url: "/challenge",
    });
    expect(shareText(model)).toContain("Boat noodles");
    expect(shareText(model)).toContain("Do you agree?");
  });

  it("creates a non-ranking food post from real dish data", () => {
    const model = buildFoodPostCard({
      lang: "en",
      dish: {
        ...dish,
        comparisons_count: 0,
        price_thb: 95,
        place: {
          name: "Victory Monument Stall",
          area: { name_en: "Victory Monument", name_th: "อนุสาวรีย์ชัยสมรภูมิ" },
        },
      },
      mode: "tried",
      url: "/dish/1",
    });
    expect(model.kind).toBe("food-post");
    expect(model.kicker).toBe("WHAT I ATE");
    expect(model.priceLabel).toBe("THB 95");
    expect(shareText(model)).not.toContain("#");
  });
});
