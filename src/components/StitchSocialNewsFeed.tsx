import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Bookmark, ChefHat, HeartHandshake, MapPin, MessageCircle,
  Share2, Sparkles, Users, Utensils, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { listFollowingPicks } from "@/lib/recommendations.functions";
import { useAuthUser } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  forYouFeed, followingFeed, mostComparedFeed, selectedAreaFeed,
  type SocialDish, type SocialPick, type SocialFeedRow,
} from "@/lib/stitch-social-feed";
import { SponsoredDiscoveryPlacement } from "@/components/SponsoredDiscoveryPlacement";

type Area = { id?:string;slug?:string;name_en?:string|null;name_th?:string|null };
type Category = { id:string;slug:string;name_en:string;name_th?:string|null };
type FeedTab = "for-you" | "following" | "nearby" | "trending";
const tabs: Array<{key:FeedTab;en:string;th:string}> = [
  {key:"for-you",en:"For You",th:"สำหรับคุณ"},
  {key:"following",en:"Following",th:"กำลังติดตาม"},
  {key:"nearby",en:"By Area",th:"ตามย่าน"},
  {key:"trending",en:"Most Compared",th:"เปรียบเทียบมากสุด"},
];

function displayName(name:string|undefined|null,other:string|undefined|null,lang:"en"|"th"){
  return lang==="th" ? other||name||"Untitled dish" : name||other||"Untitled dish";
}
function dateLabel(value:string|undefined|null,lang:"en"|"th"){
  if(!value || !Number.isFinite(Date.parse(value)))return "";
  return new Intl.DateTimeFormat(lang==="th"?"th-TH":"en-GB",{
    day:"numeric",month:"short",year:"numeric",
  }).format(Date.parse(value));
}
function shareDish(id:string){
  const url = new URL("/dish/"+encodeURIComponent(id),window.location.origin).toString();
  if(navigator.share){
    void navigator.share({url,title:"Jaannee dish"}).catch(()=>{});
  }else if(navigator.clipboard){
    void navigator.clipboard.writeText(url).then(()=>toast.success("Dish link copied"))
      .catch(()=>toast.error("Unable to copy dish link"));
  }else{
    toast.message("Open this dish to copy its URL");
  }
}

export function SocialFeedCard({row,lang}:{row:SocialFeedRow;lang:"en"|"th"}){
  const isPick=row.type==="pick";
  const dish=isPick?row.pick.dish:row.dish;
  const discoveryDish=row.type==="discovery"?row.dish:null;
  const title=displayName(dish.name_en,dish.name_th,lang);
  const subtitle=lang==="en"?dish.name_th:dish.name_en;
  const img=dish.photo_url;
  const restaurant=dish.place?.name;
  const author=isPick?row.pick.profile:null;
  const note=isPick?row.pick.note?.trim():"";
  const date=isPick?row.pick.created_at:row.dish.created_at;
  const status=isPick?(lang==="th"?"เลือกแนะนำ":"Recommended"):(lang==="th"?"จานใหม่":"New dish");
  return <article className="stitch-feed-card">
    <div className="stitch-feed-card-head">
      {author?<Link to="/u/$username" params={{username:author.username}}
        className="stitch-feed-avatar" aria-label={"View "+(author.display_name||author.username)}>
        {author.avatar_url?<img src={author.avatar_url} alt="" loading="lazy"/>:
          (author.display_name||author.username).slice(0,1).toUpperCase()}
      </Link>:<span className="stitch-feed-avatar"><Utensils size={20} aria-hidden="true"/></span>}
      <div className="min-w-0 flex-1">
        {author?<Link to="/u/$username" params={{username:author.username}}
          className="stitch-feed-author hover:underline">
          {author.display_name||"@"+author.username}
        </Link>:<p className="stitch-feed-author">{lang==="th"?"จานใหม่ในชุมชน":"Added to Jaannee"}</p>}
        <p className="stitch-feed-meta">
          {restaurant|| (lang==="th"?"จานอาหาร":"Dish")}
          {date?" · "+dateLabel(date,lang):""}
        </p>
      </div>
      <span className="stitch-feed-status">{status}</span>
    </div>
    <Link to="/dish/$id" params={{id:dish.id}} className="stitch-feed-photo"
      aria-label={(lang==="th"?"ดูรายละเอียด ":"View ")+title}>
      {img?<img src={img} alt={title} loading="lazy"/>:<ChefHat size={42} aria-hidden="true"/>}
    </Link>
    <div className="stitch-feed-body">
      <Link to="/dish/$id" params={{id:dish.id}} className="stitch-feed-dish">
        {title}
      </Link>
      {subtitle&&subtitle!==title?<span className="stitch-feed-dish-thai">{subtitle}</span>:null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[.76rem]"
        style={{color:"var(--ss-muted)"}}>
        {restaurant?<span className="inline-flex items-center gap-1">
          <MapPin size={14} aria-hidden="true"/>{restaurant}
        </span>:null}
        {discoveryDish && discoveryDish.price_thb!=null?<span className="font-semibold">
          ฿{Number(discoveryDish.price_thb).toLocaleString("en-TH")}
        </span>:null}
      </div>
      {isPick?<p className="stitch-feed-copy">
        {note ? "“"+note+"”" : lang==="th"?"ผู้ใช้นี้เลือกแนะนำจานนี้":"This diner explicitly recommends this dish."}
      </p>:<p className="stitch-feed-copy" style={{color:"var(--ss-muted)"}}>
        {lang==="th"?
          "มีการเพิ่มจานนี้เข้าระบบ แต่การลองไม่ใช่การแนะนำ":
          "A dish discovered by the community. Being listed or tried is not an endorsement."}
      </p>}
      <div className="stitch-feed-quick">
        <Link to="/dish/$id" params={{id:dish.id}}>
          <MessageCircle size={16} aria-hidden="true"/>
          {lang==="th"?"ดูจานนี้":"View dish"}
        </Link>
        <Link to="/dish/$id" params={{id:dish.id}}>
          <Bookmark size={16} aria-hidden="true"/>
          {lang==="th"?"อยากลอง":"Want to try"}
        </Link>
        <button type="button" onClick={()=>shareDish(dish.id)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-xs font-semibold"
          style={{borderColor:"var(--ss-line)",color:"var(--ss-ink)"}}>
          <Share2 size={15} aria-hidden="true"/>
          {lang==="th"?"แชร์":"Share"}
        </button>
        {discoveryDish && (discoveryDish.comparisons_count??0)>0?<span className="stitch-feed-stat">
          {discoveryDish.comparisons_count} {lang==="th"?"การเปรียบเทียบ":"comparisons"}
        </span>:null}
        {isPick?<span className="stitch-feed-stat inline-flex items-center gap-1">
          <HeartHandshake size={14} aria-hidden="true"/>
          {lang==="th"?"แนะนำจริง":"Explicit pick"}
        </span>:null}
      </div>
    </div>
  </article>;
}

function EmptyFeed({title,description,action,link}:{
  title:string;description:string;action:string;link:"/explore"|"/auth"|"/submit";
}){
  return <div className="stitch-feed-empty">
    <Utensils size={26} aria-hidden="true" className="mx-auto mb-3" style={{color:"var(--ss-primary)"}}/>
    <h3>{title}</h3>
    <p>{description}</p>
    <Link to={link}>{action}<ArrowRight size={16} className="ml-2"/></Link>
  </div>;
}

export function StitchSocialNewsFeed({dishes,areas,categories}:{
  dishes:SocialDish[];areas:Area[];categories:Category[];
}){
  const {status,userId}=useAuthUser();
  const {lang}=useI18n();
  const [tab,setTab]=useState<FeedTab>("for-you");
  const [areaSlug,setAreaSlug]=useState<string>("");
  const copy=(en:string,th:string)=>lang==="th"?th:en;
  const picks=useQuery({
    queryKey:["stitch-social-following-picks",userId],
    queryFn:()=>listFollowingPicks({data:{}}),
    enabled:status==="in",
    retry:false,
    staleTime:60_000,
  });
  const ownPicks=(picks.data??[]) as SocialPick[];
  const feed=useMemo(()=>{
    if(tab==="following")return followingFeed(ownPicks);
    if(tab==="nearby")return selectedAreaFeed(dishes,areaSlug||undefined);
    if(tab==="trending")return mostComparedFeed(dishes);
    return forYouFeed(dishes,ownPicks);
  },[tab,dishes,ownPicks,areaSlug]);
  const sortedAreas=useMemo(()=>areas.filter((a)=>a.slug&&a.name_en).slice(0,40),[areas]);
  const hasItems=feed.length>0;

  return <div className="stitch-social-feed-layout">
    <div className="stitch-feed-center">
      <div className="stitch-feed-intro">
        <p className="stitch-feed-eyebrow">{copy("Bangkok · The food conversation","กรุงเทพฯ · คนรักอาหาร")}</p>
        <h1 className="stitch-feed-title">
          {copy("What's worth eating today?","วันนี้กินอะไรดี?")}
        </h1>
        <p className="stitch-feed-subtitle">
          {copy("Real dishes, real people, and recommendations worth sharing.",
            "จานจริง คนจริง คำแนะนำจากคนที่คุณติดตาม")}
        </p>
      </div>
      <div className="stitch-feed-tabs" role="tablist" aria-label={copy("Feed sections","เลือกฟีด")}>
        {tabs.map(({key,en,th})=><button type="button" key={key} role="tab"
          aria-selected={tab===key} onClick={()=>setTab(key)}
          className="stitch-feed-tab">
          {copy(en,th)}
        </button>)}
      </div>
      {tab==="nearby"?<div className="flex items-center gap-3 border-b px-4 py-3"
        style={{background:"var(--ss-card)",borderColor:"var(--ss-line)"}}>
        <MapPin size={18} style={{color:"var(--ss-primary)"}}/>
        <label htmlFor="feed-area" className="text-xs font-semibold">
          {copy("Choose Bangkok area","เลือกย่านในกรุงเทพฯ")}
        </label>
        <select id="feed-area" value={areaSlug} onChange={e=>setAreaSlug(e.target.value)}>
          <option value="">{copy("Select an area","เลือกย่าน")}</option>
          {sortedAreas.map(a=><option key={a.slug} value={a.slug}>
            {lang==="th"?a.name_th||a.name_en:a.name_en}
          </option>)}
        </select>
      </div>:null}
      {tab==="trending"?<p className="px-4 py-3 text-xs"
        style={{color:"var(--ss-muted)"}}>
        <Zap size={15} className="mr-1 inline" aria-hidden="true"/>
        {copy("Ordered by actual dish comparisons, not sponsored placements or invented trends.",
          "เรียงตามการเปรียบเทียบจริง ไม่รวมโฆษณา")}
      </p>:null}
      {picks.isError && status==="in" && tab==="following"?<p role="status" className="px-4 py-3 text-xs"
        style={{color:"var(--ss-muted)"}}>
        {copy("Your circle is temporarily unavailable.","โหลดคำแนะนำจากคนที่ติดตามไม่ได้ในขณะนี้")}
      </p>:null}
      <div className="stitch-feed-list" role="tabpanel">
        {hasItems?feed.map(row=><SocialFeedCard key={row.id} row={row} lang={lang}/>):
          tab==="following"&&status==="out"?
            <EmptyFeed title={copy("Find your people","ติดตามคนที่ชอบ")}
              description={copy("Sign in and follow diners whose taste you trust. Only their deliberate recommendations show here.",
                "เข้าสู่ระบบและติดตามนักชิมที่คุณเชื่อใจ")}
              action={copy("Sign in","เข้าสู่ระบบ")} link="/auth"/>:
          tab==="following"?
            <EmptyFeed title={copy("No recommendations yet","ยังไม่มีคำแนะนำ")}
              description={copy("Follow diners and wait for dishes they explicitly recommend. Tried dishes don't count.",
                "ติดตามนักชิมแล้วดูจานที่พวกเขาเลือกแนะนำ")}
              action={copy("Explore dishes","ค้นหาอาหาร")} link="/explore"/>:
          tab==="nearby"&&!areaSlug?
            <EmptyFeed title={copy("Pick a neighborhood","เลือกย่านอาหาร")}
              description={copy("Choose a Bangkok area above to browse published dishes. Location access isn't needed.",
                "เลือกย่านด้านบนเพื่อดูจานเด็ด ไม่จำเป็นต้องเปิดตำแหน่ง")}
              action={copy("Explore all dishes","ค้นหาจานทั้งหมด")} link="/explore"/>:
          tab==="trending"?
            <EmptyFeed title={copy("Comparisons are just getting started","รอการเปรียบเทียบ")}
              description={copy("Once diners compare dishes they've both tried, the most-compared dishes will appear here.",
                "จานที่ถูกเปรียบเทียบจะปรากฏที่นี่")}
              action={copy("Explore","ค้นหา")} link="/explore"/>:
            <EmptyFeed title={copy("Your first discovery awaits","เริ่มค้นหาจานเด็ด")}
              description={copy("New and recommended dishes will show here when there is verified public activity.",
                "จานอาหารใหม่และคำแนะนำจริงจะปรากฏที่นี่")}
              action={copy("Discover dishes","ค้นหาอาหาร")} link="/explore"/>}
      </div>
    </div>
    <aside className="stitch-feed-side" aria-label={copy("More to discover","ค้นพบเพิ่มเติม")}>
      <section className="stitch-side-panel">
        <h2 className="stitch-side-heading flex items-center gap-2">
          <Sparkles size={17} style={{color:"var(--ss-primary)"}}/>
          {copy("Discover your next dish","ค้นหาจานต่อไป")}
        </h2>
        {categories.slice(0,6).map(c=><Link key={c.id} to="/explore"
          search={{category:c.slug}} className="stitch-side-link">
          <span>{copy(c.name_en,c.name_th||c.name_en)}</span><ArrowRight size={16}/>
        </Link>)}
        {categories.length===0?<p className="text-xs" style={{color:"var(--ss-muted)"}}>
          {copy("Categories will appear when published.","หมวดหมู่จะปรากฏเมื่อพร้อม")}
        </p>:null}
      </section>
      <section className="stitch-side-panel">
        <h2 className="stitch-side-heading flex items-center gap-2"><Users size={17}/>
          {copy("More ways to explore","สำรวจเพิ่มเติม")}
        </h2>
        <Link to="/explore" className="stitch-side-link">
          {copy("Dish explorer","ค้นหาจาน")}<ArrowRight size={16}/>
        </Link>
        <Link to="/rankings" className="stitch-side-link">
          {copy("Community dish rankings","อันดับจากชุมชน")}<ArrowRight size={16}/>
        </Link>
        <Link to="/submit" className="stitch-side-link">
          {copy("Add a dish","เพิ่มจาน")}<ArrowRight size={16}/>
        </Link>
      </section>
      <SponsoredDiscoveryPlacement/>
      <p className="px-3 text-[.7rem] leading-5" style={{color:"var(--ss-muted)"}}>
        {copy("No paid placement changes organic rankings or your friends' recommendations.",
          "โฆษณาไม่เปลี่ยนอันดับหรือคำแนะนำจากเพื่อน")}
      </p>
    </aside>
  </div>;
}
