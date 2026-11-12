import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function source(path:string){
  return readFileSync(new URL(path,import.meta.url),"utf8");
}
const saved=source("../routes/_authenticated/saved.tsx");
const auth=source("../routes/auth.tsx");
const business=source("../routes/_authenticated/business.tsx");
const businessNav=source("../components/BusinessWorkspaceNav.tsx");
const qr=source("../components/BusinessQrStudio.tsx");
const demo=source("../routes/demo.tsx");
const social=source("../components/DemoSocialPreview.tsx");
const subpages=source("../components/DemoSocialPages.tsx");
const socialCss=source("../components/StitchSocial.css");

describe("Stitch final scope — responsive Jaannee without POS",()=>{
  it("uses real private diner saved data rather than fabricated endorsements",()=>{
    expect(saved).toContain('createFileRoute("/_authenticated/saved")');
    expect(saved).toContain("myProfile()");
    expect(saved).toContain("setWantToTry({data:{dishId,saved:false}})");
    expect(saved).toContain("enabled:Boolean(userId)");
    expect(saved).toContain("No sample items have been inserted");
  });
  it("keeps one secure login with diner/business destinations",()=>{
    expect(auth).toContain('createFileRoute("/auth")');
    expect(auth).toContain('search={{redirect:"/business"}}');
    expect(auth).toContain('search={{redirect:"/"}}');
    expect(auth).toContain("supabase.auth.signInWithOtp");
    expect(auth).toContain("supabase.auth.signInWithOAuth");
    expect(auth).not.toContain("createBusinessUser");
  });
  it("provides on-device business navigation while retaining underlying verified workflows",()=>{
    expect(business).toContain("<BusinessWorkspaceNav hasRestaurant={Boolean(selected)}/>");
    for(const name of ["business-overview","business-menu","business-ai","business-qr",
      "business-plan","business-growth","business-ads"]){
      expect(business).toContain("id=\""+name+"\"");
      expect(businessNav).toContain(name);
    }
    expect(business).toContain("submitBusinessForReview");
    expect(business).toContain("upsertBusinessMenuItem");
    expect(business).toContain("setBusinessMenuPublished");
  });
  it("shows a permanent read-only QR menu and prints without handling restaurant payments",()=>{
    expect(business).toContain("<BusinessQrStudio");
    expect(qr).toContain("quickchart.io/qr");
    expect(qr).toContain("encodeURIComponent(url)");
    expect(qr).toContain("stitch-qr-print-card");
    expect(qr).toContain("window.print()");
    expect(qr).toContain("not take orders");
    expect(qr).toContain("first-party QR generation");
    expect(qr).not.toContain("checkout.sessions");
  });
  it("makes every demo detail route use social design while preserving classic",()=>{
    expect(demo).toContain('!classic ? <DemoSocialPreview view={view} id={id} /> : <DemoExperience />');
    expect(social).toContain("DemoSocialPages");
    expect(social).toContain("toggleSaved");
    expect(social).toContain("toggleTried");
    expect(social).toContain("recommendations");
    for(const part of ["DishView","PlaceView","ProfileView","SavedView",
      "RankingsView","PeopleView","MeView"]){
      expect(subpages).toContain(part);
    }
    expect(subpages).toContain("Marking a dish as tried does not endorse it.");
    expect(subpages).toContain("fictional");
    expect(subpages).not.toMatch(/request waiter|order tray|pay bill|POS synchronization/i);
  });
  it("matches actual final Stitch visual tokens instead of inventing another theme",()=>{
    expect(socialCss).toContain("--ss-canvas: #faf9fd");
    expect(socialCss).toContain("--ss-primary: #aa3000");
    expect(socialCss).toContain("--ss-green: #006d36");
    expect(socialCss).toContain("@media (min-width: 768px)");
    expect(socialCss).toContain("@media (min-width: 1320px)");
  });
});
