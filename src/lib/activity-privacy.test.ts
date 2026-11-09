import { describe, expect, it } from "vitest";
import { isPublicActivity } from "./activity-privacy";

describe("public activity privacy", () => {
  it("hides tried activity when the profile is absent or unclaimed", () => {
    expect(isPublicActivity({ type: "tried", profile: null })).toBe(false);
    expect(isPublicActivity({ type: "tried", profile: { username: null, tried_public: true } })).toBe(false);
  });

  it("does not mistake a missing setting for public consent", () => {
    expect(isPublicActivity({ type: "tried", profile: { username: "sam" } })).toBe(false);
    expect(isPublicActivity({ type: "tried", profile: { username: "sam", tried_public: false } })).toBe(false);
  });

  it("shows explicitly public tried activity and public posts", () => {
    expect(isPublicActivity({ type: "tried", profile: { username: "sam", tried_public: true } })).toBe(true);
    expect(isPublicActivity({ type: "posted", profile: { username: "sam", tried_public: false } })).toBe(true);
  });
});
