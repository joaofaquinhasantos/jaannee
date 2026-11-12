import { useState } from "react";
import {
  ArrowRight, Bell, Bookmark, Compass, Home, MapPin, Menu, Moon, Plus,
  Search, Share2, Sparkles, Store, Sun, UserRound, Utensils,
} from "lucide-react";
import {
  DEMO_DISCLAIMER, demoCategories, demoDishes, demoPeople, demoRestaurants,
} from "@/lib/demo-data";
import "@/components/StitchSocial.css";

type DemoTab="for-you"|"following"|"by-area"|"compared";
const tabNames:Record<DemoTab,string>={
  "for-you":"For You",following:"Following","by-area":"By Area",compared:"Most Compared",
};
const nav=[
  {name:"Home",Icon:Home},
  {name:"Explore",Icon:Compass},
  {name:"Add",Icon:Plus},
  {name:"Activity",Icon:Bell},
  {name:"Profile",Icon:UserRound},
];
const restaurant=new Map(demoRestaurants.map(r=>[r.id,r]));
const picks=demoPeople.flatMap(person=>person.picks.map(p=>({person,dish:demoDishes.find(d=>d.id===p.dishId)!,note:p.note})))
  .filter(item=>Boolean(item.dish));
function fullPreviewTab(tab:DemoTab,area:string){
  if(tab==="following")return picks.slice(0,9);
  if(tab==="by-area")return demoDishes.filter(d=>restaurant.get(d.restaurantId)?.area===area)
    .slice(0,12).map(dish=>({dish,person:null,note:""}));
  if(tab==="compared")return [...demoDishes].sort((a,b)=>b.comparisons-a.comparisons)
    .slice(0,12).map(dish=>({dish,person:null,note:""}));
  const results: Array<{dish:(typeof demoDishes)[number];person:(typeof demoPeople)[number]|null;note:string}>=[];
  const recent=picks.slice(0,5);
  for(let i=0;i<8;i++){
    if(recent[i%recent.length] && i%2===0) {
      const p=recent[i%recent.length];
      results.push({dish:p.dish,person:p.person,note:p.note});
    }else{
      results.push({dish:demoDishes[(i*4+3)%demoDishes.length],person:null,note:""});
    }
  }
  return results;
}
export function DemoSocialPreview(){
  const [tab,setTab]=useState<DemoTab>("for-you");
  const [area,setArea]=useState("Ari");
  const [dark,setDark]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const cards=fullPreviewTab(tab,area);
  const areas=[...new Set(demoRestaurants.map(r=>r.area))].sort();
  const demoLink=(id:string)=>"/demo?view=dish&id="+encodeURIComponent(id);
  return <div className={"stitch-social min-h-[100dvh]"+(dark?" stitch-social-dark":"")}>
    <aside className="stitch-social-sidebar" aria-label="Preview navigation">
      <a href="/demo-social" className="stitch-brand">
        <span className="stitch-brand-mark">จ</span>
        <span className="stitch-brand-name">Jaannee</span>
      </a>
      <p className="stitch-brand-subtitle">Your city. One delicious dish at a time.</p>
      <nav className="stitch-sidebar-links">
        {nav.map(({name,Icon})=><a key={name}
          href={name==="Explore"?"/demo?view=discover&classic=true":name==="Profile"?"/demo?view=me":
            name==="Activity"?"/demo?view=people":name==="Add"?"/demo?view=discover&classic=true":"/demo-social"}
          className={"stitch-sidebar-link"+(name==="Home"?" is-active":"")}>
          <Icon size={21}/><span>{name}</span>
        </a>)}
      </nav>
      <a href="/demo?view=discover&classic=true" className="stitch-sidebar-cta"><Plus size={17}/><span>Add a dish</span></a>
      <div className="stitch-sidebar-bottom">
        <a href="/demo-business?screen=home" className="stitch-sidebar-business"><Store size={18}/><span>For restaurants</span></a>
        <p>Fictional social-design preview. No ordering or POS.</p>
      </div>
    </aside>
    <div className="stitch-social-workspace">
      <header className="stitch-social-topbar">
        <div className="stitch-social-topbar-left">
          <button className="stitch-mobile-more" type="button" aria-expanded={menuOpen}
            aria-label="Preview shortcuts" onClick={()=>setMenuOpen(!menuOpen)}>
            <Menu size={22}/>
          </button>
          <a href="/demo-social" className="stitch-top-brand"><span className="stitch-top-brand-symbol">จ</span> Jaannee</a>
          <span className="stitch-topbar-caption">Bangkok food discoveries</span>
        </div>
        <div className="stitch-top-actions">
          <a href="/demo?view=discover&classic=true" className="stitch-icon-action" aria-label="Explore demo dishes"><Search size={19}/></a>
          <button className="stitch-icon-action" type="button" onClick={()=>setDark(!dark)}
            aria-label={dark?"Light preview":"Dark preview"}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button>
          <span className="stitch-lang-toggle" aria-label="Sample preview language">EN</span>
        </div>
      </header>
      {menuOpen?<div className="stitch-mobile-shortcuts">
        <a href="/demo?view=discover&classic=true"><Compass size={18}/> Explore sample dishes</a>
        <a href="/demo-business?screen=home"><Store size={18}/> Business concept</a>
      </div>:null}
      <div role="status" className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide"
        style={{background:"var(--ss-primary-soft)",color:"var(--ss-primary)"}}>
        {DEMO_DISCLAIMER} · Social UI preview
        <a href="/demo?view=discover&classic=true"
          className="ml-3 inline-flex min-h-9 items-center rounded-full border border-current px-3 align-middle text-[11px] font-extrabold normal-case tracking-normal underline-offset-2 hover:underline">
          Classic discovery demo
        </a>
      </div>
      <main className="stitch-social-main">
        <div className="stitch-social-feed-layout">
          <div className="stitch-feed-center">
            <header className="stitch-feed-intro">
              <p className="stitch-feed-eyebrow">Bangkok · Fictional community preview</p>
              <h1 className="stitch-feed-title">What's worth eating today?</h1>
              <p className="stitch-feed-subtitle">
                Discover dishes through people you trust. Illustrative mockups, not live reviews.
              </p>
            </header>
            <div role="tablist" aria-label="Sample feed filters" className="stitch-feed-tabs">
              {(Object.keys(tabNames) as DemoTab[]).map(key=><button key={key} role="tab"
                type="button" className="stitch-feed-tab" aria-selected={tab===key}
                onClick={()=>setTab(key)}>{tabNames[key]}</button>)}
            </div>
            {tab==="by-area"?<div className="flex items-center gap-3 px-4 py-3">
              <MapPin size={18}/>
              <label htmlFor="social-preview-area" className="text-xs font-semibold">Choose an area</label>
              <select id="social-preview-area" value={area} onChange={e=>setArea(e.target.value)}>
                {areas.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>:null}
            <div className="stitch-feed-list">
              {cards.map(({dish,person,note},i)=><article className="stitch-feed-card" key={dish.id+"-"+i}>
                <div className="stitch-feed-card-head">
                  <span className="stitch-feed-avatar">{person?person.initials:<Utensils size={20}/>}</span>
                  <div className="min-w-0 flex-1">
                    <p className="stitch-feed-author">{person?.name??"Fictional dish discovery"}</p>
                    <p className="stitch-feed-meta">
                      {restaurant.get(dish.restaurantId)?.name} · {restaurant.get(dish.restaurantId)?.area}
                    </p>
                  </div>
                  <span className="stitch-feed-status">{person?"Sample pick":"Sample dish"}</span>
                </div>
                <a href={demoLink(dish.id)} className="stitch-feed-photo" aria-label={"View sample "+dish.name}>
                  <img src={dish.image} alt={"Illustrative photo for "+dish.name} loading="lazy"/>
                </a>
                <div className="stitch-feed-body">
                  <a href={demoLink(dish.id)} className="stitch-feed-dish">{dish.name}</a>
                  <span className="stitch-feed-dish-thai">{dish.nameTh}</span>
                  <p className="mt-2 text-xs" style={{color:"var(--ss-muted)"}}>
                    {restaurant.get(dish.restaurantId)?.name} · ฿{dish.price}
                  </p>
                  <p className="stitch-feed-copy">{note||dish.description}</p>
                  <div className="stitch-feed-quick">
                    <a href={demoLink(dish.id)}><Bookmark size={16}/> Want to try</a>
                    <a href={demoLink(dish.id)}><ArrowRight size={16}/> Dish details</a>
                    <button type="button" onClick={()=>{
                      const url=window.location.origin+demoLink(dish.id);
                      if(navigator.clipboard)void navigator.clipboard.writeText(url).catch(()=>{});
                    }} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-xs font-semibold"
                      style={{borderColor:"var(--ss-line)"}}><Share2 size={16}/> Share</button>
                  </div>
                </div>
              </article>)}
            </div>
          </div>
          <aside className="stitch-feed-side">
            <section className="stitch-side-panel">
              <h2 className="stitch-side-heading flex items-center gap-2">
                <Sparkles size={17}/> Sample categories
              </h2>
              {demoCategories.slice(0,7).map(c=><a key={c} href="/demo?view=discover&classic=true"
                className="stitch-side-link">{c}<ArrowRight size={16}/></a>)}
            </section>
            <section className="stitch-side-panel">
              <h2 className="stitch-side-heading">Business tools</h2>
              <a href="/demo-business?screen=home" className="stitch-side-link">
                Free digital menu and QR <ArrowRight size={16}/>
              </a>
              <p className="mt-3 text-xs leading-6" style={{color:"var(--ss-muted)"}}>
                Fictional businesses and mock activity; no restaurant orders or payments.
              </p>
            </section>
          </aside>
        </div>
      </main>
      <footer className="stitch-social-footer">Jaannee · Fictional design preview · No real diner activity</footer>
    </div>
    <nav className="stitch-bottom-navigation" aria-label="Mobile preview navigation">
      {nav.map(({name,Icon})=><a key={name}
        href={name==="Explore"?"/demo?view=discover&classic=true":name==="Profile"?"/demo?view=me":
          name==="Activity"?"/demo?view=people":name==="Add"?"/demo?view=discover&classic=true":"/demo-social"}
        className={"stitch-bottom-link"+(name==="Home"?" is-active":"")+
          (name==="Add"?" stitch-bottom-add":"")}>
        <Icon size={name==="Add"?24:21}/><span>{name}</span>
      </a>)}
    </nav>
  </div>;
}
