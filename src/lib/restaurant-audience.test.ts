import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";

const server=readFileSync(new URL("./restaurant-audience.functions.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../components/BusinessAudiencePanel.tsx",import.meta.url),"utf8");
const business=readFileSync(new URL("../routes/_authenticated/business.tsx",import.meta.url),"utf8");
const nav=readFileSync(new URL("../components/BusinessWorkspaceNav.tsx",import.meta.url),"utf8");

describe("restaurant audience statistics privacy",()=>{
  it("requires the authenticated verified business owner before service-role counting",()=>{
    expect(server).toContain("requireSupabaseAuth");
    expect(server).toContain('.eq("owner_id",context.userId)');
    expect(server).toContain('owner.data.review_status!=="verified"');
    expect(server.indexOf("owner.data.review_status")).toBeLessThan(
      server.indexOf('import("@/integrations/supabase/client.server")')
    );
  });
  it("counts only explicit consent without returning people or marketing contact details",()=>{
    expect(server).toContain('.eq("allow_vouchers",true)');
    expect(server).toContain('.eq("allow_messages",true)');
    expect(server).toContain('.select("user_id",{count:"exact",head:true})');
    expect(server).toContain("followers:followers.count??0");
    expect(server).toContain("voucherOptIns:vouchersAllowed.count??0");
    expect(server).toContain("announcementOptIns:messagesAllowed.count??0");
    expect(server).not.toContain("return followers.data");
    expect(server).not.toContain("email");
    expect(server).not.toContain("phone");
    expect(ui).toContain("not estimates");
  });
  it("shows unavailable data rather than fabricated audience numbers",()=>{
    expect(ui).toContain("Audience statistics are unavailable");
    expect(ui).toContain("We will not display invented figures");
    expect(ui).toContain("q.data[key].toLocaleString");
    expect(business).toContain('<div id="business-audience"><BusinessAudiencePanel');
    expect(nav).toContain('id:"business-audience"');
  });
});
