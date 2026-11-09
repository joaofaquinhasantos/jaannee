import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  followingFeed, forYouFeed, mostComparedFeed, selectedAreaFeed,
  type SocialDish, type SocialPick,
} from "./stitch-social-feed";

const dishes: SocialDish[] = [
  {id:"a",status:"approved",name_en:"A",created_at:"2026-11-09T09:00:00Z",comparisons_count:5,place:{name:"Example",area:{slug:"ari"}}},
  {id:"b",status:"approved",name_en:"B",created_at:"2026-11-08T09:00:00Z",comparisons_count:17,place:{name:"Example",area:{slug:"thong-lo"}}},
  {id:"c",status:"pending",name_en:"C",created_at:"2026-11-09T11:00:00Z",comparisons_count:900,place:{name:"Example",area:{slug:"ari"}}},
  {id:"d",status:"approved",name_en:"D",created_at:"2026-11-06T09:00:00Z",comparisons_count:0,place:{name:"Example",area:{slug:"ari"}}},
];
const picks: SocialPick[] = [
  { user_id:"u1",dish_id:"b",note:"I choose to recommend this dish",
    created_at:"2026-11-09T09:45:00Z",
    dish:{id:"b",name_en:"B",status:"approved"},
    profile:{username:"genuine_diner",display_name:"Genuine diner"} },
  { user_id:"u2",dish_id:"c",note:"Not public",
    created_at:"2026-11-09T10:00:00Z",
    dish:{id:"c",name_en:"C",status:"pending"},
    profile:{username:"other_diner"} },
  { user_id:"u3",dish_id:"a",note:"No public profile",
    created_at:"2026-11-09T08:00:00Z",
    dish:{id:"a",name_en:"A",status:"approved"},
    profile:{username:""} },
];

describe("Stitch-inspired social discovery", () => {
  it("shows only approved and explicitly recommended dishes in Following", () => {
    const rows=followingFeed(picks);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("u1:b");
    expect(rows[0].type).toBe("pick");
    expect(followingFeed([])).toEqual([]);
  });
  it("interleaves real recommendations and new approved dishes without duplicate endorsements", () => {
    const rows=forYouFeed(dishes,picks);
    expect(rows[0].type).toBe("pick");
    const discoveryIds=rows.filter(r=>r.type==="discovery").map(r=>r.id);
    expect(discoveryIds).toEqual(["a","d"]);
    expect(discoveryIds).not.toContain("c");
    expect(discoveryIds).not.toContain("b");
    expect(forYouFeed(dishes,picks,2).length).toBeLessThanOrEqual(2);
  });
  it("uses actual comparison counts, not invented trending scores", () => {
    const rows=mostComparedFeed(dishes);
    expect(rows.map(r=>r.id)).toEqual(["b","a"]);
    expect(rows.some(r=>r.id==="c")).toBe(false);
  });
  it("uses manually selected neighborhoods, without pretending to know user's position", () => {
    expect(selectedAreaFeed(dishes,undefined)).toEqual([]);
    expect(selectedAreaFeed(dishes,"ari").map(r=>r.id)).toEqual(["a","d"]);
    expect(selectedAreaFeed(dishes,"thong-lo").map(r=>r.id)).toEqual(["b"]);
  });
  it("keeps existing restaurant menu and independent rankings available", () => {
    const nav=readFileSync(new URL("../components/StitchSocialShell.tsx",import.meta.url),"utf8");
    const home=readFileSync(new URL("../routes/index.tsx",import.meta.url),"utf8");
    const explore=readFileSync(new URL("../routes/explore.tsx",import.meta.url),"utf8");
    const feed=readFileSync(new URL("../components/StitchSocialNewsFeed.tsx",import.meta.url),"utf8");
    expect(nav).toContain('to: "/explore"');
    expect(nav).toContain('to: "/activity"');
    expect(nav).toContain('to: "/submit"');
    expect(nav).toContain('to: "/profile"');
    expect(explore).toContain('createFileRoute("/explore")');
    expect(explore).toContain("DishBrowser");
    expect(home).toContain("temporarilyUnavailable: true");
    expect(feed).toContain("SponsoredDiscoveryPlacement");
    expect(feed).toContain("mostComparedFeed");
    expect(feed).toContain("followingFeed");
    expect(feed).not.toMatch(/call waiter|order tray|pay bill|POS sync/i);
  });
});
