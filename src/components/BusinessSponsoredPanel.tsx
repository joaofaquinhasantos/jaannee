import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Megaphone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createSponsoredDraft,listMySponsoredBoosts,purchaseSponsoredBoost,submitSponsoredDraft,
} from "@/lib/sponsored-boosts.functions";

export function BusinessSponsoredPanel({businessId}:{businessId:string}) {
  const qc=useQueryClient();
  const [headline,setHeadline]=useState("");
  const [description,setDescription]=useState("");
  const [area,setArea]=useState("");
  const [category,setCategory]=useState("");
  const listings=useQuery({
    queryKey:["business-sponsorships",businessId],
    queryFn:()=>listMySponsoredBoosts({data:{businessId}}),
    enabled:Boolean(businessId),retry:false,
  });
  const enabled=false; // Deliberate: no paid launch before pricing and end-to-end QA.
  const refresh=()=>qc.invalidateQueries({queryKey:["business-sponsorships",businessId]});
  const create=useMutation({
    mutationFn:()=>createSponsoredDraft({data:{
      businessId,headline,body:description,
      areaSlug:area.trim()||null,
      categorySlug:category.trim()||null,
      promotionCampaignId:null,
    }}),
    onSuccess:async()=>{
      setHeadline("");setDescription("");setArea("");setCategory("");
      await refresh();toast.success("Sponsored draft saved for review");
    },
    onError:(error:Error)=>toast.error(error.message),
  });
  const submit=useMutation({
    mutationFn:(boostId:string)=>submitSponsoredDraft({data:{businessId,boostId}}),
    onSuccess:async()=>{await refresh();toast.success("Submitted for advertising review");},
    onError:(error:Error)=>toast.error(error.message),
  });
  const buy=useMutation({
    mutationFn:(boostId:string)=>purchaseSponsoredBoost({data:{businessId,boostId}}),
    onSuccess:({url})=>window.location.assign(url),
    onError:(error:Error)=>toast.error(error.message),
  });

  return <section className="space-y-6 border border-border p-5 sm:p-7">
    <header>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
        <Megaphone size={17}/> Separate paid advertising
      </p>
      <h2 className="mt-2 font-display text-3xl">Sponsored discovery placements</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
        Paid advertisements appear in a visibly labeled slot outside the
        community-ranked dishes and Trusted Picks. Promotions never change dish
        votes, ranking positions, user recommendations, or search relevance.
      </p>
      <p className="mt-3 border-l-2 border-amber-400 bg-secondary/20 p-3 text-xs leading-6">
        Advertising payments are currently disabled. You may prepare a draft for
        review, but no purchase or publication can take place until pricing,
        payment verification, and moderation are activated.
      </p>
    </header>

    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3 border border-border p-4">
        <h3 className="font-display text-2xl">Create a sponsored draft</h3>
        <label className="block space-y-1"><span className="text-sm font-semibold">Headline</span>
          <Input value={headline} maxLength={90} placeholder="Discover our weekend menu"
            onChange={(e)=>setHeadline(e.target.value)}/>
        </label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Restaurant promotion description</span>
          <Textarea rows={4} maxLength={260} value={description}
            onChange={(e)=>setDescription(e.target.value)}/>
        </label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Target area slug (optional)</span>
          <Input value={area} maxLength={80} placeholder="e.g. thong-lo"
            onChange={(e)=>setArea(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}/>
        </label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Dish category slug (optional)</span>
          <Input value={category} maxLength={80} placeholder="e.g. pad-thai"
            onChange={(e)=>setCategory(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}/>
        </label>
        <p className="text-xs leading-6 text-muted-foreground">
          Optional targeting must match an existing area or category.
          Leave blank for all areas and categories.
        </p>
        <Button onClick={()=>create.mutate()} disabled={
          create.isPending||headline.trim().length<5||description.trim().length<5
        }>Save advertising draft</Button>
      </div>

      <div className="space-y-3 border border-border p-4">
        <h3 className="font-display text-2xl">Your advertisements</h3>
        {listings.isLoading?<p className="text-sm text-muted-foreground">Loading advertising drafts…</p>:null}
        {listings.isError?<p role="alert" className="text-sm text-muted-foreground">
          Advertising records are unavailable while Supabase access is limited.
        </p>:null}
        {!listings.isLoading&&!(listings.data??[]).length?<p className="text-sm text-muted-foreground">
          No sponsored placements prepared yet.
        </p>:null}
        {(listings.data??[]).map((item:any)=><article key={item.id}
          className="space-y-3 border-t border-border py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm">{item.headline}</strong>
            <span className="text-[10px] font-bold uppercase text-primary">{item.review_status}</span>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">{item.body}</p>
          <p className="text-[11px] text-muted-foreground">
            Payment: {item.payment_status} · Target: {item.target_area_slug||"All areas"}
            {item.target_category_slug?" · "+item.target_category_slug:""}
          </p>
          {item.review_note?<p className="text-xs leading-6 text-muted-foreground">
            Reviewer: {item.review_note}
          </p>:null}
          {item.review_status==="draft"?<Button size="sm" variant="outline"
            onClick={()=>submit.mutate(item.id)} disabled={submit.isPending}>
            Submit for human review
          </Button>:null}
          {item.review_status==="approved"&&item.payment_status==="unpaid"?<Button
            size="sm" variant="outline" disabled={!enabled||buy.isPending}
            onClick={()=>buy.mutate(item.id)}>
            <ArrowUpRight size={14} className="mr-2"/> Purchase 7-day placement (not enabled)
          </Button>:null}
          {item.payment_status==="paid"&&item.ends_at?<p className="text-xs text-emerald-500">
            <ShieldCheck size={14} className="mr-1 inline"/>
            Expires {new Date(item.ends_at).toLocaleDateString("en-TH")}
          </p>:null}
        </article>)}
      </div>
    </div>
    <div className="flex items-start gap-3 border-t border-border pt-4">
      <ShieldCheck size={20} className="mt-1 shrink-0 text-primary"/>
      <p className="text-xs leading-6 text-muted-foreground">
        Every placement requires ownership verification, manual content review,
        and payment confirmation before it can appear in the feed.
        Paid placements will always carry a clear Sponsored label. Pricing TBD.
      </p>
    </div>
    <Link to="/demo-business" search={{screen:"growth"}}
      className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">
      See the proposed Growth business experience <ArrowUpRight size={15}/>
    </Link>
  </section>;
}
