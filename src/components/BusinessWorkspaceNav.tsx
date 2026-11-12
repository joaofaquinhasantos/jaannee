import { Link } from "@tanstack/react-router";
import { BookOpen, CreditCard, Megaphone, QrCode, ShieldCheck, Sparkles, Store, Utensils } from "lucide-react";
import "./BusinessWorkspaceNav.css";

const sections=[
  {id:"business-overview",label:"Overview",icon:Store},
  {id:"business-menu",label:"Menu",icon:Utensils},
  {id:"business-ai",label:"AI review",icon:Sparkles},
  {id:"business-qr",label:"QR menu",icon:QrCode},
  {id:"business-plan",label:"Plans",icon:CreditCard},
  {id:"business-audience",label:"Audience",icon:ShieldCheck},
  {id:"business-growth",label:"Growth",icon:Megaphone},
  {id:"business-ads",label:"Sponsored",icon:ShieldCheck},
] as const;

export function BusinessWorkspaceNav({hasRestaurant}:{hasRestaurant:boolean}){
  const jump=(id:string)=>{
    const node=document.getElementById(id);
    if(!node)return;
    const reduce=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
  };
  return <nav aria-label="Restaurant workspace sections" className="stitch-business-navigation">
    <div className="stitch-business-nav-top">
      <span className="stitch-business-mode-label"><Store size={17}/> Business mode</span>
      <Link to="/" className="stitch-business-diner-link">
        <BookOpen size={16}/> Return to diner feed
      </Link>
    </div>
    <div className="stitch-business-nav-scroll">
      {sections.map(({id,label,icon:Icon})=><button type="button" key={id}
        disabled={!hasRestaurant && id!=="business-overview"}
        onClick={()=>jump(id)}
        className="stitch-business-nav-action"
        title={label}>
        <Icon size={17} aria-hidden="true"/>
        <span>{label}</span>
      </button>)}
    </div>
  </nav>;
}
