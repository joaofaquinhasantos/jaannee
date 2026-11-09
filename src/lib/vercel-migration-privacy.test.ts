import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("Vercel migration privacy contract", () => {
  it("authenticates Google through Supabase rather than Lovable", () => {
    const auth = read("src/routes/auth.tsx");
    expect(auth).toContain("supabase.auth.signInWithOAuth");
    expect(auth).not.toContain("lovable.auth.signInWithOAuth");
  });

  it("does not expose unpublished dishes in public profiles", () => {
    const dishes = read("src/lib/dishes.functions.ts");
    const section = dishes.split("export const publicProfile")[1].split("export const submitReport")[0];
    expect(section).toContain('.eq("status", "approved")');
    expect(section).not.toContain('.in("status", ["pending", "approved"])');
    const restaurants = read("src/lib/restaurant.functions.ts");
    const publicSection = restaurants.split("export const getPublicRestaurantProfile")[1];
    expect(publicSection).toContain('.eq("status", "approved")');
    expect(publicSection).not.toContain('.in("status", ["pending", "approved"])');
  });

  it("requires a verified user for private media previews", () => {
    const photos = read("src/routes/photos.$.ts");
    expect(photos).toContain("supabaseAdmin.auth.getUser(token)");
    expect(photos).toContain('.eq("role", "admin")');
    expect(photos).toContain("canPreviewPrivatePhoto(path, request)");
    const admin = read("src/components/AdminPhoto.tsx");
    expect(admin).toContain("Authorization: `Bearer ${token}`");
  });

  it("does not serve arbitrary storage paths anonymously", () => {
    const photos = read("src/routes/photos.$.ts");
    expect(photos).toContain("isPublishedPhoto(path)");
    expect(photos).toContain('.eq("status", "approved")');
    expect(photos).not.toContain("max-age=31536000");
  });
});
