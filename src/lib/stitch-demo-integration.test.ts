import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEMO_DISCLAIMER, demoDishes, demoPeople } from "./demo-data";

const main = readFileSync(new URL("../routes/demo.tsx", import.meta.url), "utf8");
const social = readFileSync(new URL("../components/DemoSocialPreview.tsx", import.meta.url), "utf8");
const standalone = readFileSync(new URL("../routes/demo-social.tsx", import.meta.url), "utf8");

describe("Stitch social preview as default demo experience", () => {
  it("opens the new responsive feed on the existing demo route", () => {
    expect(main).toContain('createFileRoute("/demo")');
    expect(main).toContain("component: DemoRouteExperience");
    expect(main).toContain('view === "discover" && !classic ? <DemoSocialPreview /> : <DemoExperience />');
    expect(main).toContain('search.classic === 1');
  });
  it("preserves the original interactive demo and its eight routes", () => {
    expect(main).toContain('type View = "discover" | "rankings" | "people" | "dish" | "place" | "profile" | "saved" | "me"');
    expect(main).toContain("function DemoExperience()");
    expect(main).toContain("New social feed");
    expect(social).toContain("Classic discovery demo");
    expect(social).toContain("/demo?view=discover&classic=true");
    expect(social).toContain('/demo?view=dish&id=');
  });
  it("works without Supabase and labels fictional social proof", () => {
    expect(social).toContain("DEMO_DISCLAIMER");
    expect(social).toContain("Fictional community preview");
    expect(social).toContain("Sample pick");
    expect(social).not.toMatch(/supabase|stripe|createServerFn|order food|call waiter|pay bill/i);
    expect(DEMO_DISCLAIMER).toContain("Fictional venues and diners");
    expect(demoDishes.length).toBeGreaterThanOrEqual(20);
    expect(demoPeople.length).toBeGreaterThanOrEqual(3);
  });
  it("retains a separate public social-preview route for direct comparison", () => {
    expect(standalone).toContain('createFileRoute("/demo-social")');
    expect(standalone).toContain("component: DemoSocialPreview");
    expect(standalone).toContain("noindex,nofollow,noarchive");
  });
});
