import { describe, expect, it } from "vitest";
import { localizedName, secondaryName } from "@/lib/names";

describe("bilingual names", () => {
  it("prefers Thai in Thai mode and falls back to English", () => {
    expect(localizedName({ name_en: "Boat noodles", name_th: "ก๋วยเตี๋ยวเรือ" }, "th")).toBe(
      "ก๋วยเตี๋ยวเรือ",
    );
    expect(localizedName({ name_en: "Boat noodles", name_th: null }, "th")).toBe("Boat noodles");
  });

  it("prefers English in English mode and falls back to Thai", () => {
    expect(localizedName({ name_en: "Boat noodles", name_th: "ก๋วยเตี๋ยวเรือ" }, "en")).toBe(
      "Boat noodles",
    );
    expect(localizedName({ name_en: "", name_th: "ก๋วยเตี๋ยวเรือ" }, "en")).toBe(
      "ก๋วยเตี๋ยวเรือ",
    );
  });

  it("does not repeat the primary name as a secondary name", () => {
    expect(secondaryName({ name_en: "Pad Thai", name_th: "Pad Thai" }, "en")).toBeNull();
  });
});
