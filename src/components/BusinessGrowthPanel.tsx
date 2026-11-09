import { useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { Check, Gift, Heart, Megaphone, ShieldCheck, Ticket, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getBusinessBillingState } from "@/lib/restaurant-billing.functions";
import {
  createRestaurantCampaign,getMyRestaurantCampaigns,publishRestaurantCampaign,
  redeemFollowerVoucher,
} from "@/lib/restaurant-growth.functions";
import {
  configureRestaurantLoyalty,confirmRestaurantLoyaltyCode,
  getPublicRestaurantLoyalty,
} from "@/lib/restaurant-loyalty.functions";

export function BusinessGrowthPanel({businessId}:{businessId:string}){
  const qc=useQueryClient();
  const [kind,setKind]=useState<"promotion"|"voucher">("promotion");
  const [title,setTitle]=useState("");
  const [message,setMessage]=useState("");
  const [discount,setDiscount]=useState(10);
  const [days,setDays]=useState(7);
  const [voucherCode,setVoucherCode]=useState("");
  const [loyaltyTitle,setLoyaltyTitle]=useState("Your neighborhood regulars");
  const [reward,setReward]=useState("A complimentary dessert");
  const [visits,setVisits]=useState(5);
  const [guestCode,setGuestCode]=useState("");

  const billing=useQuery({
    queryKey:["business-billing",businessId],
    queryFn:()=>getBusinessBillingState({data:{businessId}}),
    enabled:Boolean(businessId),retry:false,
  });
  const hasGrowth=billing.data?.tier==="growth" &&
    ["active","trialing"].includes(billing.data.status);
  const campaigns=useQuery({
    queryKey:["business-growth-campaigns",businessId],
    queryFn:()=>getMyRestaurantCampaigns({data:{businessId}}),
    enabled:Boolean(businessId),retry:false,
  });
  const loyalty=useQuery({
    queryKey:["public-loyalty-program",businessId],
    queryFn:()=>getPublicRestaurantLoyalty({data:{businessId}}),
    enabled:Boolean(businessId),retry:false,
  });
  const refresh=async()=>{
    await Promise.all([
      qc.invalidateQueries({queryKey:["business-growth-campaigns",businessId]}),
      qc.invalidateQueries({queryKey:["public-loyalty-program",businessId]}),
    ]);
  };
  const create=useMutation({
    mutationFn:()=>{
      const now=Date.now();
      return createRestaurantCampaign({data:{
        businessId,kind,title,message,
        discountPercent:kind==="voucher"?discount:null,
        startsAt:new Date(now+60_000).toISOString(),
        endsAt:new Date(now+days*86400_000).toISOString(),
      }});
    },
    onSuccess:async()=>{setTitle("");setMessage("");await refresh();toast.success("Private campaign draft saved");},
    onError:(error:Error)=>toast.error(error.message),
  });
  const publish=useMutation({
    mutationFn:(input:{campaignId:string;activate:boolean})=>publishRestaurantCampaign({data:{businessId,...input}}),
    onSuccess:async()=>{await refresh();toast.success("Campaign status updated");},
    onError:(error:Error)=>toast.error(error.message),
  });
  const redeem=useMutation({
    mutationFn:()=>redeemFollowerVoucher({data:{businessId,code:voucherCode.trim()}}),
    onSuccess:()=>{setVoucherCode("");toast.success("Voucher redeemed once");},
    onError:(error:Error)=>toast.error(error.message),
  });
  const program=useMutation({
    mutationFn:()=>configureRestaurantLoyalty({data:{
      businessId,title:loyaltyTitle,rewardDescription:reward,
      visitsRequired:visits,active:true,
    }}),
    onSuccess:async()=>{await refresh();toast.success("Loyalty program saved");},
    onError:(error:Error)=>toast.error(error.message),
  });
  const checkin=useMutation({
    mutationFn:()=>confirmRestaurantLoyaltyCode({data:{businessId,token:guestCode.trim()}}),
    onSuccess:(result)=>{
      setGuestCode("");
      toast.success(result.reward_ready?"Reward earned — guest may redeem next":"Visit recorded");
    },
    onError:(error:Error)=>toast.error(error.message),
  });
  return <section className="space-y-6 border border-border p-5 sm:p-7">
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Growth tools</p>
      <h2 className="mt-2 font-display text-3xl">Promotions, vouchers and loyalty</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
        Restaurant promotion and retention tools are separate from independent dish rankings.
        Vouchers appear only to followers who opted in. There is no mass messaging or paid boosting enabled.
      </p>
    </div>
    {!hasGrowth?<p className="border-l-2 border-amber-400 p-4 text-sm leading-6 text-muted-foreground">
      A verified restaurant with an active Growth subscription is required. These controls
      remain inactive while billing or live database access is unavailable.
    </p>:null}

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 border border-border p-4 sm:p-5">
        <div className="flex items-center gap-2"><Megaphone size={20} className="text-primary"/>
          <h3 className="font-display text-2xl">New campaign</h3>
        </div>
        <label className="block space-y-1"><span className="text-sm font-semibold">Type</span>
          <select className="min-h-11 w-full border border-border bg-background p-2 text-sm"
            value={kind} onChange={(e)=>setKind(e.target.value as "voucher"|"promotion")}>
            <option value="promotion">In-app restaurant promotion</option>
            <option value="voucher">Opt-in follower voucher</option>
          </select>
        </label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Title</span>
          <Input value={title} maxLength={80} onChange={(e)=>setTitle(e.target.value)} placeholder="Weekend lunch special"/>
        </label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Description or terms</span>
          <Textarea rows={3} maxLength={320} value={message} onChange={(e)=>setMessage(e.target.value)}/>
        </label>
        {kind==="voucher"?<label className="block space-y-1">
          <span className="text-sm font-semibold">Discount %</span>
          <Input type="number" min={1} max={90} value={discount}
            onChange={(e)=>setDiscount(Math.max(1,Math.min(90,Number(e.target.value)||1)))}/>
        </label>:null}
        <label className="block space-y-1"><span className="text-sm font-semibold">Duration</span>
          <select className="min-h-11 w-full border border-border bg-background p-2 text-sm"
            value={days} onChange={(e)=>setDays(Number(e.target.value))}>
            <option value={3}>3 days</option><option value={7}>7 days</option>
            <option value={14}>14 days</option><option value={30}>30 days</option>
          </select>
        </label>
        <Button disabled={!hasGrowth||create.isPending||title.trim().length<3||message.trim().length<3}
          onClick={()=>create.mutate()}>Save campaign as draft</Button>
        <p className="text-xs leading-6 text-muted-foreground">
          No followers are contacted. Publishing a voucher makes it available only
          to diners who explicitly opted in to receive voucher offers.
        </p>
      </section>

      <section className="space-y-4 border border-border p-4 sm:p-5">
        <div className="flex items-center gap-2"><Gift size={20} className="text-primary"/>
          <h3 className="font-display text-2xl">My campaigns</h3>
        </div>
        {campaigns.isLoading?<p className="text-xs text-muted-foreground">Loading drafts…</p>:null}
        {campaigns.isError?<p className="text-xs text-muted-foreground">Campaigns unavailable while the database is restricted.</p>:null}
        {!(campaigns.data??[]).length&&!campaigns.isLoading?<p className="text-sm text-muted-foreground">
          No promotions or voucher campaigns created yet.
        </p>:null}
        {(campaigns.data??[]).map((c:any)=><article key={c.id} className="space-y-2 border-b border-border pb-4 last:border-0">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">{c.title}</strong>
            <span className="text-[10px] font-bold uppercase text-muted-foreground">{c.status}</span>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">{c.kind} · {c.message}</p>
          {c.status==="draft"?<Button variant="outline" size="sm"
            disabled={!hasGrowth||publish.isPending}
            onClick={()=>publish.mutate({campaignId:c.id,activate:true})}>
            <Check size={14} className="mr-1"/> Activate
          </Button>:c.status==="active"?<Button variant="outline" size="sm"
            disabled={!hasGrowth||publish.isPending}
            onClick={()=>publish.mutate({campaignId:c.id,activate:false})}>Archive</Button>:null}
        </article>)}
      </section>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 border border-border p-4 sm:p-5">
        <div className="flex items-center gap-2"><Ticket size={20} className="text-primary"/>
          <h3 className="font-display text-2xl">Redeem a guest voucher</h3>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          A guest presents their in-app voucher code at the counter. Only an authenticated
          owner can redeem it, and a code cannot be redeemed twice.
        </p>
        <Input value={voucherCode} maxLength={30} placeholder="JNN-…"
          onChange={(e)=>setVoucherCode(e.target.value)}/>
        <Button disabled={!hasGrowth||redeem.isPending||voucherCode.trim().length<10}
          onClick={()=>redeem.mutate()}>Redeem voucher once</Button>
      </section>

      <section className="space-y-4 border border-border p-4 sm:p-5">
        <div className="flex items-center gap-2"><Heart size={20} className="text-primary"/>
          <h3 className="font-display text-2xl">Loyalty program</h3>
        </div>
        {loyalty.data?<p className="text-xs text-emerald-500">
          Active: {loyalty.data.title} · {loyalty.data.visits_required} visits
        </p>:null}
        <label className="block space-y-1"><span className="text-sm font-semibold">Program name</span>
          <Input value={loyaltyTitle} maxLength={80} onChange={(e)=>setLoyaltyTitle(e.target.value)}/>
        </label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Reward</span>
          <Input value={reward} maxLength={200} onChange={(e)=>setReward(e.target.value)}/>
        </label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Visits to earn</span>
          <Input type="number" min={3} max={12} value={visits}
            onChange={(e)=>setVisits(Math.max(3,Math.min(12,Number(e.target.value)||3)))}/>
        </label>
        <Button variant="outline" disabled={!hasGrowth||program.isPending||
          loyaltyTitle.trim().length<3||reward.trim().length<3}
          onClick={()=>program.mutate()}>Save loyalty program</Button>
        <p className="text-xs leading-6 text-muted-foreground">
          Once diners join, the required number of visits cannot change. Only staff may
          award a stamp after a guest shows a short-lived check-in code.
        </p>
        <div className="space-y-3 border-t border-border pt-4">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Guest check-in code</span>
            <Textarea rows={3} value={guestCode} maxLength={800}
              onChange={(e)=>setGuestCode(e.target.value)}
              placeholder="Paste the code shown in the guest's loyalty card…"/>
          </label>
          <Button disabled={!hasGrowth||checkin.isPending||guestCode.trim().length<30}
            onClick={()=>checkin.mutate()}><ShieldCheck size={16} className="mr-2"/> Confirm guest visit or reward</Button>
        </div>
      </section>
    </div>

    <div className="border border-dashed border-border p-5">
      <div className="flex items-center gap-2"><Users size={18} className="text-primary"/>
        <h3 className="font-display text-2xl">Sponsored placements</h3>
      </div>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        Pay-per-boost advertising remains unavailable until campaign billing and review are
        connected. Future feed placements will be visibly labeled Sponsored and will never
        change community rankings or appear as friends' recommendations.
      </p>
    </div>
  </section>;
}
