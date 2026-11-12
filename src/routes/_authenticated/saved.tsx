import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Compass, MapPin, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { StitchSocialShell } from "@/components/StitchSocialShell";
import { myProfile, setWantToTry } from "@/lib/dishes.functions";
import { useAuthUser } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import "./saved.css";

export const Route=createFileRoute("/_authenticated/saved")({
  head:()=>({meta:[
    {title:"Want to Try · Jaannee"},
    {name:"robots",content:"noindex,nofollow"},
  ]}),
  component:SavedDishCollection,
});

type SavedDish={
  id:string;name_en:string;name_th?:string|null;
  photo_url?:string|null;price_thb?:number|null;
  category?:{name_en:string;name_th?:string|null}|null;
  place?:{name:string;area?:{name_en?:string|null;name_th?:string|null}|null}|null;
};

function SavedDishCollection(){
  const {userId}=useAuthUser();
  const {lang}=useI18n();
  const qc=useQueryClient();
  const copy=(en:string,th:string)=>lang==="th"?th:en;
  const profile=useQuery({
    queryKey:["profile",userId],queryFn:()=>myProfile(),
    enabled:Boolean(userId),retry:false,staleTime:30_000,
  });
  const items=((profile.data?.want_to_try??[]) as Array<{dish?:SavedDish|null}>)
    .map(row=>row.dish).filter((d):d is SavedDish=>Boolean(d?.id));
  const remove=useMutation({
    mutationFn:(dishId:string)=>setWantToTry({data:{dishId,saved:false}}),
    onSuccess:async()=>{
      await qc.invalidateQueries({queryKey:["profile"]});
      toast.success(copy("Removed from Want to Try","ลบออกจากรายการอยากลองแล้ว"));
    },
    onError:(err:Error)=>toast.error(err.message),
  });
  return <StitchSocialShell>
    <div className="stitch-saved-page">
      <header className="stitch-saved-heading">
        <p className="stitch-feed-eyebrow">{copy("Your personal food shortlist","รายการอาหารที่เก็บไว้")}</p>
        <div className="stitch-saved-header-row">
          <div>
            <h1 className="stitch-feed-title">{copy("Want to Try","อยากลอง")}</h1>
            <p className="stitch-feed-subtitle">
              {copy("Keep dishes you want to eat, not restaurant orders or reservations.",
                "บันทึกจานที่อยากลอง ไม่ใช่คำสั่งซื้อหรือการจองร้าน")}
            </p>
          </div>
          <span className="stitch-saved-count">{items.length} {copy("saved","รายการ")}</span>
        </div>
      </header>

      {profile.isLoading?<div className="stitch-saved-status" role="status">
        {copy("Loading saved dishes…","กำลังโหลดจานที่บันทึก…")}
      </div>:null}
      {profile.isError?<div className="stitch-saved-status" role="alert">
        {copy("Your saved dishes are temporarily unavailable. No sample items have been inserted.",
          "ไม่สามารถโหลดรายการที่บันทึกได้ในขณะนี้")}
      </div>:null}
      {!profile.isLoading&&!profile.isError&&items.length===0?
        <div className="stitch-saved-empty">
          <Bookmark size={31} aria-hidden="true"/>
          <h2>{copy("Start your food shortlist","เริ่มเก็บจานที่อยากลอง")}</h2>
          <p>{copy("Browse dishes, open the ones you like and tap Want to Try. Saved dishes stay private to your account.",
            "ค้นหาจานอาหารแล้วเพิ่มในรายการอยากลอง")}</p>
          <Link to="/explore"><Compass size={17}/>{copy("Explore dishes","ค้นหาอาหาร")}</Link>
        </div>:null}
      {items.length?<div className="stitch-saved-grid">
        {items.map(item=>{
          const title=lang==="th" ? item.name_th||item.name_en : item.name_en;
          const area=lang==="th"?item.place?.area?.name_th||item.place?.area?.name_en:
            item.place?.area?.name_en||item.place?.area?.name_th;
          return <article key={item.id} className="stitch-saved-card">
            <Link to="/dish/$id" params={{id:item.id}} className="stitch-saved-photo"
              aria-label={copy("View ","ดู ")+title}>
              {item.photo_url?<img src={item.photo_url} alt={title} loading="lazy"/>:
                <UtensilsCrossed size={31} aria-hidden="true"/>}
            </Link>
            <div className="stitch-saved-content">
              <p className="stitch-feed-eyebrow">{item.category?.name_en||copy("Dish","จานอาหาร")}</p>
              <Link to="/dish/$id" params={{id:item.id}} className="stitch-saved-name">{title}</Link>
              <p className="stitch-saved-meta">
                <MapPin size={14} aria-hidden="true"/>{item.place?.name||copy("Restaurant unavailable","ไม่พบร้าน")}
                {area?" · "+area:""}
              </p>
              <div className="stitch-saved-actions">
                {item.price_thb!=null?<span>฿{Number(item.price_thb).toLocaleString("en-TH")}</span>:<span/>}
                <button type="button" disabled={remove.isPending}
                  onClick={()=>remove.mutate(item.id)}
                  aria-label={copy("Remove ","ลบ ")+title}
                  title={copy("Remove from Want to Try","ลบออกจากรายการอยากลอง")}>
                  <Trash2 size={16} aria-hidden="true"/><span>{copy("Remove","ลบ")}</span>
                </button>
              </div>
            </div>
          </article>;
        })}
      </div>:null}
    </div>
  </StitchSocialShell>;
}
