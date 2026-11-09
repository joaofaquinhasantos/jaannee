import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { Check, Megaphone, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listSponsoredReviews,reviewSponsoredBoost } from "@/lib/sponsored-boosts.functions";
import { useAuthUser } from "@/lib/use-auth";

export const Route=createFileRoute("/_authenticated/sponsored-reviews")({
  head:()=>({meta:[
    {title:"Advertising moderation · JaanNee"},
    {name:"robots",content:"noindex,nofollow"},
  ]}),
  component:SponsoredReviews,
});

function SponsoredReviews() {
  const {userId}=useAuthUser();
  const qc=useQueryClient();
  const [notes,setNotes]=useState<Record<string,string>>({});
  const pending=useQuery({
    queryKey:["moderate-sponsored-ads",userId],
    queryFn:()=>listSponsoredReviews(),
    enabled:Boolean(userId),
    retry:false,
  });
  const review=useMutation({
    mutationFn:(input:{boostId:string;approved:boolean})=>reviewSponsoredBoost({data:{
      ...input,note:notes[input.boostId]?.trim()??"",
    }}),
    onSuccess:async(_result,input)=>{
      await qc.invalidateQueries({queryKey:["moderate-sponsored-ads"]});
      toast.success(input.approved?"Sponsored content approved for purchase":"Sponsored content rejected");
    },
    onError:(error:Error)=>toast.error(error.message),
  });

  return <AppShell tone="noir">
    <main className="mx-auto max-w-5xl space-y-6 pb-16">
      <header className="border-b border-border pb-6">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          <Megaphone size={17}/> Administrator · Advertising
        </p>
        <h1 className="mt-3 font-display text-4xl uppercase sm:text-5xl">Sponsored content review</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Review advertising claims, ownership, and targeting before accepting payment.
          Reject misleading content, impersonation or unsupported offers.
          Approval does not publish or charge for an advertisement.
        </p>
        <Link to="/business" className="mt-4 inline-block text-sm underline underline-offset-4">
          Back to business workspace
        </Link>
      </header>
      {pending.isLoading?<p className="text-sm text-muted-foreground">Loading sponsored drafts…</p>:null}
      {pending.isError?<p role="alert" className="border border-primary/30 p-5 text-sm text-muted-foreground">
        Administrative access required, or the database is currently unavailable.
      </p>:null}
      {pending.data?.length===0?<p className="border border-border p-5 text-sm text-muted-foreground">
        No sponsored placements awaiting review.
      </p>:null}
      {(pending.data??[]).map((ad:any)=><article key={ad.id} className="space-y-4 border border-border p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-amber-300/50 bg-amber-300/10 px-2 py-1 text-[11px] font-bold uppercase text-amber-200">
            Sponsored · unverified claim
          </span>
          <span className="text-xs text-muted-foreground">
            Submitted by {Array.isArray(ad.restaurant)?ad.restaurant[0]?.name:ad.restaurant?.name??"Restaurant"}
          </span>
        </div>
        <h2 className="font-display text-3xl">{ad.headline}</h2>
        <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{ad.body}</p>
        <p className="text-xs text-muted-foreground">
          Requested area: {ad.target_area_slug||"Any"}
          {" · "}Category: {ad.target_category_slug||"Any"}
        </p>
        <div className="border-l-2 border-amber-400 p-3 text-xs leading-6 text-muted-foreground">
          <ShieldAlert size={15} className="mr-2 inline"/>
          Paid exposure must remain completely separate from community recommendations and rankings.
          Check the restaurant and promotion details before approval.
        </div>
        <label className="block space-y-2"><span className="text-sm font-semibold">Moderation findings and reason</span>
          <Textarea rows={3} maxLength={1000} value={notes[ad.id]??""}
            onChange={(e)=>setNotes((current)=>({...current,[ad.id]:e.target.value}))}
            placeholder="Provide the verification method or reason for rejection…"/>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={review.isPending||(notes[ad.id]?.trim().length??0)<10}
            onClick={()=>{
              if(window.confirm("Confirm that all statements and targeting were reviewed?")){
                review.mutate({boostId:ad.id,approved:true});
              }
            }}><Check size={16} className="mr-2"/> Approve for future purchase</Button>
          <Button variant="outline" disabled={review.isPending||(notes[ad.id]?.trim().length??0)<10}
            onClick={()=>review.mutate({boostId:ad.id,approved:false})}>
            <X size={16} className="mr-2"/> Reject advertisement
          </Button>
        </div>
      </article>)}
    </main>
  </AppShell>;
}
