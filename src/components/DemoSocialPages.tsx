import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowRight, Bookmark, Check, HeartHandshake,
  MapPin, Share2, Utensils, Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  demoCategories, demoDishes, demoPeople, demoRestaurants, rankDemoDishes,
  restaurantFor, type DemoDish,
} from "@/lib/demo-data";
import "./DemoSocialPages.css";

export type SocialDemoView =
  | "discover" | "rankings" | "people" | "dish" | "place" | "profile" | "saved" | "me";

type Props = {
  view: Exclude<SocialDemoView, "discover">;
  id?:string;
  saved:Set<string>;
  tried:Set<string>;
  recommendations:Record<string,string>;
  following:Set<string>;
  toggleSave:(id:string)=>void;
  toggleTried:(id:string)=>void;
  recommend:(id:string,note:string)=>void;
  toggleFollowing:(username:string)=>void;
  share:(view:SocialDemoView,id?:string)=>void;
};

function SampleCard({dish,saved,onSave}:{
  dish:DemoDish;saved:boolean;onSave:(id:string)=>void;
}){
  const place=restaurantFor(dish);
  return <article className="stitch-demo-tile">
    <Link to="/demo" search={{view:"dish",id:dish.id}} className="stitch-demo-tile-photo">
      <img src={dish.image} loading="lazy" alt={"Illustrative "+dish.name}/>
      <span className="stitch-demo-sample-label">Sample dish</span>
    </Link>
    <div className="stitch-demo-tile-info">
      <p className="stitch-feed-eyebrow">{dish.category}</p>
      <Link to="/demo" search={{view:"dish",id:dish.id}} className="stitch-demo-tile-title">{dish.name}</Link>
      <p className="stitch-demo-tile-meta">{place.name} · {place.area}</p>
      <div className="stitch-demo-tile-bottom">
        <span>฿{dish.price} <small>sample price</small></span>
        <button type="button" onClick={()=>onSave(dish.id)}
          aria-pressed={saved} aria-label={(saved?"Remove saved ":"Save ")+dish.name}>
          <Bookmark size={19} fill={saved?"currentColor":"none"}/>
        </button>
      </div>
    </div>
  </article>;
}

function PageIntro({eyebrow,title,subtitle}:{
  eyebrow:string;title:string;subtitle:string;
}){
  return <header className="stitch-demo-page-intro">
    <p className="stitch-feed-eyebrow">{eyebrow}</p>
    <h1 className="stitch-feed-title">{title}</h1>
    <p className="stitch-feed-subtitle">{subtitle}</p>
  </header>;
}

function DishView({dish,props}:{dish:DemoDish;props:Props}){
  const [note,setNote]=useState(props.recommendations[dish.id]??"");
  const tried=props.tried.has(dish.id);
  const saved=props.saved.has(dish.id);
  const canRecommend=tried&&note.trim().length>=10;
  const others=demoDishes.filter(d=>d.category===dish.category&&d.id!==dish.id).slice(0,3);
  const place=restaurantFor(dish);
  return <div className="stitch-demo-dish-page">
    <div className="stitch-demo-dish-photo">
      <img src={dish.image} alt={"Illustrative photograph for "+dish.name}/>
      <span>Illustrative food photography · Fictional dish</span>
    </div>
    <div className="stitch-demo-dish-columns">
      <div>
        <Link to="/demo" search={{view:"discover"}} className="stitch-demo-back">
          <ArrowLeft size={17}/> Back to feed
        </Link>
        <p className="stitch-feed-eyebrow">{dish.category} · Sample dish</p>
        <h1 className="stitch-demo-dish-title">{dish.name}</h1>
        <p className="stitch-demo-dish-subtitle">{dish.nameTh}</p>
        <Link to="/demo" search={{view:"place",id:place.id}} className="stitch-demo-place-link">
          <MapPin size={17}/>{place.name} · {place.area}<ArrowRight size={16}/>
        </Link>
        <p className="stitch-demo-dish-description">{dish.description}</p>
        <div className="stitch-demo-dish-actions">
          <button onClick={()=>props.toggleTried(dish.id)} type="button" aria-pressed={tried}>
            <Check size={17}/>{tried?"Tried ✓":"I tried it"}
          </button>
          <button onClick={()=>props.toggleSave(dish.id)} type="button" aria-pressed={saved}>
            <Bookmark size={17} fill={saved?"currentColor":"none"}/>
            {saved?"Saved":"Want to Try"}
          </button>
          <button type="button" onClick={()=>props.share("dish",dish.id)}>
            <Share2 size={17}/>Share
          </button>
        </div>
        {tried?<section className="stitch-demo-recommend">
          <h2>Recommend this dish</h2>
          <p>Marking a dish as tried does not endorse it. Write a deliberate recommendation if you enjoyed it.</p>
          <label htmlFor="sample-recommend-note">Your genuine impression · sample only</label>
          <textarea id="sample-recommend-note" rows={3} maxLength={180}
            value={note} onChange={e=>setNote(e.target.value)}
            placeholder="What made this particular dish memorable?"/>
          <button type="button" disabled={!canRecommend}
            onClick={()=>props.recommend(dish.id,note.trim())}>
            <HeartHandshake size={17}/> Save sample recommendation
          </button>
          {props.recommendations[dish.id]?<p role="status">
            Your sample recommendation: {props.recommendations[dish.id]}
          </p>:null}
        </section>:null}
      </div>
      <aside className="stitch-demo-info-side">
        <div className="stitch-demo-info-box">
          <p className="stitch-feed-eyebrow">Illustrative community data</p>
          <div className="stitch-demo-stat-grid">
            <div><strong>{dish.score}</strong><span>Sample score</span></div>
            <div><strong>{dish.comparisons}</strong><span>Sample comparisons</span></div>
            <div><strong>฿{dish.price}</strong><span>Sample price</span></div>
          </div>
          <p>These metrics are fictional design fixtures, not real diner rankings or payments.</p>
        </div>
        <div className="stitch-demo-info-box">
          <h2>Others in {dish.category}</h2>
          <div className="stitch-demo-mini-list">
            {others.map(d=><Link to="/demo" search={{view:"dish",id:d.id}} key={d.id}>
              <img src={d.image} alt="" loading="lazy"/><span>{d.name}<small>{restaurantFor(d).name}</small></span>
              <ArrowRight size={15}/>
            </Link>)}
          </div>
        </div>
      </aside>
    </div>
  </div>;
}

function PlaceView({id,props}:{id:string;props:Props}){
  const place=demoRestaurants.find(r=>r.id===id);
  if(!place)return <NotFound/>;
  const dishes=demoDishes.filter(d=>d.restaurantId===place.id);
  return <div className="stitch-demo-inner">
    <PageIntro eyebrow="Fictional restaurant page" title={place.name}
      subtitle={place.intro}/>
    <p className="stitch-demo-place-link"><MapPin size={18}/>{place.area} · {place.subtitle}</p>
    <div className="stitch-demo-section-title">
      <h2>Explore the dishes</h2>
      <span>{dishes.length} illustrated dishes</span>
    </div>
    <div className="stitch-demo-card-grid">
      {dishes.map(dish=><SampleCard key={dish.id} dish={dish}
        saved={props.saved.has(dish.id)} onSave={props.toggleSave}/>)}
    </div>
    <div className="stitch-demo-disclaimer">
      Restaurant profile and dishes are fictional. This read-only view is for food discovery, not table ordering, POS, payment or reservations.
    </div>
    <Link to="/demo-business" search={{screen:"menu"}} className="stitch-demo-plain-link">
      Preview free business menu tools <ArrowRight size={16}/>
    </Link>
  </div>;
}

function PeopleView({props}:{props:Props}){
  return <div className="stitch-demo-inner">
    <PageIntro eyebrow="Your food circle · Sample" title="People who share their picks"
      subtitle="Find diners with similar taste. Every person in this preview is fictional."/>
    <div className="stitch-demo-person-grid">
      {demoPeople.map(p=><article key={p.username} className="stitch-demo-person-card">
        <Link to="/demo" search={{view:"profile",id:p.username}}>
          <span className="stitch-demo-person-avatar" style={{background:p.color}}>{p.initials}</span>
          <strong>{p.name}</strong><small>@{p.username}</small>
        </Link>
        <p>{p.bio}</p>
        <button type="button" onClick={()=>props.toggleFollowing(p.username)}
          aria-pressed={props.following.has(p.username)}>
          <Users size={16}/>{props.following.has(p.username)?"Following":"Follow"}
        </button>
      </article>)}
    </div>
  </div>;
}
function ProfileView({id,props}:{id:string;props:Props}){
  const person=demoPeople.find(p=>p.username===id);
  if(!person)return <NotFound/>;
  const endorsed=person.picks.map(p=>demoDishes.find(d=>d.id===p.dishId)).filter((d):d is DemoDish=>Boolean(d));
  return <div className="stitch-demo-inner">
    <div className="stitch-demo-profile-hero">
      <span className="stitch-demo-person-avatar" style={{background:person.color}}>{person.initials}</span>
      <div>
        <p className="stitch-feed-eyebrow">Fictional diner profile</p>
        <h1>{person.name}</h1><p>@{person.username}</p><p>{person.bio}</p>
        <button type="button" onClick={()=>props.toggleFollowing(person.username)}
          aria-pressed={props.following.has(person.username)}>
          <Users size={16}/>{props.following.has(person.username)?"Following":"Follow"}
        </button>
      </div>
    </div>
    <div className="stitch-demo-section-title">
      <h2>Explicit recommendations</h2>
      <span>{endorsed.length} sample picks</span>
    </div>
    <div className="stitch-demo-card-grid">
      {endorsed.map(d=><SampleCard key={d.id} dish={d}
        saved={props.saved.has(d.id)} onSave={props.toggleSave}/>)}
    </div>
  </div>;
}
function RankingsView({props}:{props:Props}){
  const [category,setCategory]=useState<string>("");
  const rows=rankDemoDishes(category?demoDishes.filter(d=>d.category===category):demoDishes);
  return <div className="stitch-demo-inner">
    <PageIntro eyebrow="Fictional community ranking" title="Find the top dishes"
      subtitle="Illustrative sample scores based on fictional comparisons. Sponsored content never affects rankings."/>
    <div className="stitch-demo-filter-pills" aria-label="Sample dish categories">
      <button aria-pressed={!category} type="button" onClick={()=>setCategory("")}>All dishes</button>
      {demoCategories.map(c=><button key={c} aria-pressed={category===c}
        type="button" onClick={()=>setCategory(c)}>{c}</button>)}
    </div>
    <div className="stitch-demo-card-grid">
      {rows.slice(0,24).map(d=><SampleCard key={d.id} dish={d}
        saved={props.saved.has(d.id)} onSave={props.toggleSave}/>)}
    </div>
  </div>;
}
function SavedView({props}:{props:Props}){
  const rows=demoDishes.filter(d=>props.saved.has(d.id));
  return <div className="stitch-demo-inner">
    <PageIntro eyebrow="Private shortlist · Session demo" title="Want to Try"
      subtitle="Save dishes you want to eat. No food orders, reservations or restaurant-bill payments."/>
    {rows.length?<div className="stitch-demo-card-grid">
      {rows.map(d=><SampleCard key={d.id} dish={d} saved onSave={props.toggleSave}/>)}
    </div>:<div className="stitch-demo-empty">
      <Bookmark size={29}/><h2>No dishes saved yet</h2>
      <p>Browse the social feed or rankings, and tap Want to Try on a sample dish.</p>
      <Link to="/demo" search={{view:"discover"}}>Browse the feed <ArrowRight size={16}/></Link>
    </div>}
  </div>;
}
function MeView({props}:{props:Props}){
  const choices=demoDishes.filter(d=>props.recommendations[d.id]);
  const tried=demoDishes.filter(d=>props.tried.has(d.id));
  return <div className="stitch-demo-inner">
    <PageIntro eyebrow="Sample private profile" title="My food story"
      subtitle="A fictional account preview. Changes last only while you browse this demo."/>
    <div className="stitch-demo-summary-grid">
      <div><strong>{choices.length}</strong><span>Recommended</span></div>
      <div><strong>{tried.length}</strong><span>Tried</span></div>
      <div><strong>{props.saved.size}</strong><span>Want to Try</span></div>
    </div>
    <div className="stitch-demo-section-title"><h2>Your recommendations</h2></div>
    {choices.length?<div className="stitch-demo-card-grid">
      {choices.map(d=><SampleCard key={d.id} dish={d}
        saved={props.saved.has(d.id)} onSave={props.toggleSave}/>)}
    </div>:<div className="stitch-demo-empty">
      <HeartHandshake size={30}/><h2>No recommendations yet</h2>
      <p>Mark a sample dish as tried, write a deliberate recommendation, and it will appear here.</p>
      <Link to="/demo" search={{view:"rankings"}}>Explore sample dishes <ArrowRight size={16}/></Link>
    </div>}
    <div className="stitch-demo-section-title"><h2>Want to Try</h2></div>
    <Link to="/demo" search={{view:"saved"}} className="stitch-demo-plain-link">
      View {props.saved.size} saved dishes <Bookmark size={17}/>
    </Link>
  </div>;
}
function NotFound(){
  return <div className="stitch-demo-empty">
    <Utensils size={29}/><h1>That sample item is unavailable</h1>
    <Link to="/demo" search={{view:"discover"}}>Back to feed <ArrowRight size={16}/></Link>
  </div>;
}

export function DemoSocialPages(props:Props){
  const {view,id}=props;
  if(view==="dish"){
    const dish=demoDishes.find(d=>d.id===id);
    return dish?<DishView key={dish.id} dish={dish} props={props}/>:<NotFound/>;
  }
  if(view==="place")return <PlaceView id={id||""} props={props}/>;
  if(view==="profile")return <ProfileView id={id||""} props={props}/>;
  if(view==="people")return <PeopleView props={props}/>;
  if(view==="rankings")return <RankingsView props={props}/>;
  if(view==="saved")return <SavedView props={props}/>;
  return <MeView props={props}/>;
}
