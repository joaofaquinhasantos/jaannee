import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HeartHandshake, Users } from "lucide-react";
import { StitchSocialShell } from "@/components/StitchSocialShell";
import { SocialFeedCard } from "@/components/StitchSocialNewsFeed";
import { listFollowingPicks } from "@/lib/recommendations.functions";
import { followingFeed, type SocialPick } from "@/lib/stitch-social-feed";
import { useAuthUser } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [
    { title: "Your circle · Jaannee" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: ActivityPage,
});

/**
 * Current Activity scope is limited to explicit recommendations from followed
 * diners. Likes, comment notifications and restaurant marketing push messages
 * are NOT implemented and must not be simulated in the UI.
 */
function ActivityPage(){
  const {userId}=useAuthUser();
  const {lang}=useI18n();
  const copy=(en:string,th:string)=>lang==="th"?th:en;
  const picks=useQuery({
    queryKey:["stitch-activity-following",userId],
    queryFn:()=>listFollowingPicks({data:{}}),
    enabled:Boolean(userId),
    retry:false,
    staleTime:60_000,
  });
  const rows=followingFeed((picks.data??[]) as SocialPick[]);
  return <StitchSocialShell>
    <div className="mx-auto max-w-[720px] px-0 pt-5 sm:px-4">
      <header className="px-4 pb-5">
        <p className="stitch-feed-eyebrow flex items-center gap-2">
          <Users size={16} aria-hidden="true"/>
          {copy("Your circle","คนที่คุณติดตาม")}
        </p>
        <h1 className="stitch-feed-title mt-2">{copy("Activity","กิจกรรม")}</h1>
        <p className="stitch-feed-subtitle">
          {copy("Recent dish recommendations from people you follow. Only deliberate picks appear here.",
            "คำแนะนำจานอาหารล่าสุดจากคนที่คุณติดตาม")}
        </p>
      </header>
      {picks.isLoading?<div className="stitch-feed-empty" role="status">
        {copy("Loading your circle…","กำลังโหลด…")}
      </div>:picks.isError?<div className="stitch-feed-empty" role="alert">
        {copy("Your activity is temporarily unavailable.","ไม่สามารถโหลดกิจกรรมได้ในขณะนี้")}
      </div>:rows.length?<div className="stitch-feed-list">
        {rows.map(row=><SocialFeedCard key={row.id} row={row} lang={lang}/>)}
      </div>:<div className="stitch-feed-empty">
        <HeartHandshake className="mx-auto mb-3" size={32} style={{color:"var(--ss-primary)"}}/>
        <h2>{copy("Your circle is quiet for now","ยังไม่มีกิจกรรมใหม่")}</h2>
        <p>{copy("Follow diners to see their genuine dish recommendations here. Marking a dish as tried does not generate an endorsement.",
          "ติดตามนักชิมเพื่อดูจานที่พวกเขาเลือกแนะนำ")}</p>
        <Link to="/explore">{copy("Find dishes","ค้นหาอาหาร")}</Link>
      </div>}
    </div>
  </StitchSocialShell>;
}
