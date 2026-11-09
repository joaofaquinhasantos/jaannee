import { Link } from "@tanstack/react-router";
import { useEffect,useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { Check,Gift,Heart,Megaphone,ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/lib/use-auth";
import {
  followRestaurantBusiness,getMyRestaurantFollow,getPublicRestaurantPromotions,
} from "@/lib/restaurant-growth.functions";
import { getPublicRestaurantLoyalty } from "@/lib/restaurant-loyalty.functions";

export function PublicRestaurantGrowth({businessId,placeId}:{businessId:string;placeId:string}){
  const {status,userId}=useAuthUser();
  const qc=useQueryClient();
  const [voucherConsent,setVoucherConsent]=useState(false);
  const [messageConsent,setMessageConsent]=useState(false);
  const follow=useQuery({
    queryKey:["my-restaurant-follow",businessId,userId],
    queryFn:()=>getMyRestaurantFollow({data:{businessId}}),
    enabled:status==="in" && Boolean(userId),retry:false,
  });
  const promotions=useQuery({
    queryKey:["public-restaurant-promotions",businessId],
    queryFn:()=>getPublicRestaurantPromotions({data:{businessId}}),
    retry:false,
  });
  const loyalty=useQuery({
    queryKey:["public-loyalty-program",businessId],
    queryFn:()=>getPublicRestaurantLoyalty({data:{businessId}}),
    retry:false,
  });
  useEffect(()=>{
    setVoucherConsent(follow.data?.allow_vouchers??false);
    setMessageConsent(follow.data?.allow_messages??false);
  },[follow.data]);
  const mutate=useMutation({
    mutationFn:(shouldFollow:boolean)=>followRestaurantBusiness({data:{
      businessId,follow:shouldFollow,allowVouchers:shouldFollow&&voucherConsent,
      allowMessages:shouldFollow&&messageConsent,
    }}),
    onSuccess:async()=>{
      await qc.invalidateQueries({queryKey:["my-restaurant-follow",businessId]});
      toast.success("Restaurant preferences saved");
    },
    onError:(error:Error)=>toast.error(error.message),
  });
  const following=Boolean(follow.data);

  return <section className="stitch-container stitch-section space-y-6">
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Restaurant community</p>
      <h2 className="mt-2 font-display text-3xl">Stay close to this restaurant</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Follow the restaurant without automatically subscribing to advertising or vouchers.
        Your marketing preferences are separate and can be changed at any time.
      </p>
    </div>
    {status==="out"?<Link to="/auth" search={{redirect:"/place/"+placeId}}
      className="inline-flex min-h-11 items-center gap-2 border border-primary px-4 text-sm font-bold">
      <Heart size={16}/> Sign in to follow
    </Link>:status==="in"?<div className="max-w-2xl space-y-4 border border-border p-5">
      <p className="inline-flex items-center gap-2 text-sm font-semibold">
        <Heart size={17} className="text-primary"/> {following?"You're following this restaurant":"Follow this restaurant"}
      </p>
      <div className="space-y-3">
        <label className="flex items-start gap-3 text-sm leading-6">
          <input type="checkbox" checked={voucherConsent} className="mt-1 h-4 w-4"
            onChange={(e)=>setVoucherConsent(e.target.checked)}/>
          Allow this restaurant to show me voucher offers in my JaanNee account.
        </label>
        <label className="flex items-start gap-3 text-sm leading-6">
          <input type="checkbox" checked={messageConsent} className="mt-1 h-4 w-4"
            onChange={(e)=>setMessageConsent(e.target.checked)}/>
          Allow restaurant announcements. No direct messages are currently being sent.
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={mutate.isPending||follow.isLoading} onClick={()=>mutate.mutate(true)}>
          {following?<Check size={16} className="mr-2"/>:<Heart size={16} className="mr-2"/>}
          {following?"Save my preferences":"Follow with chosen preferences"}
        </Button>
        {following?<Button variant="outline" disabled={mutate.isPending}
          onClick={()=>mutate.mutate(false)}>Unfollow and withdraw consent</Button>:null}
      </div>
      <Link to="/offers" className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">
        <Gift size={16}/> My vouchers
      </Link>
      <p className="text-xs leading-6 text-muted-foreground">
        Your consent is not shared with other restaurants. Unfollowing withdraws these
        permissions. Diner food rankings are not affected.
      </p>
    </div>:null}

    {loyalty.data?<div className="flex flex-wrap items-center justify-between gap-4 border border-border p-5">
      <div><p className="text-xs font-bold uppercase text-primary">Loyalty program</p>
        <h3 className="mt-2 font-display text-2xl">{loyalty.data.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {loyalty.data.visits_required} verified visits · {loyalty.data.reward_description}
        </p>
      </div>
      <Link to="/loyalty/$businessId" params={{businessId}}
        className="inline-flex min-h-11 items-center gap-2 border border-primary px-4 text-sm font-bold">
        <ShieldCheck size={16}/> My loyalty card
      </Link>
    </div>:null}

    {(promotions.data??[]).length?<section>
      <div className="flex items-center gap-2"><Megaphone size={19} className="text-primary"/>
        <h3 className="font-display text-2xl">Official restaurant promotions</h3>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        These are restaurant-authored offers, not independent food rankings or personal recommendations.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(promotions.data??[]).map((p:any)=><article key={p.id} className="border border-border bg-secondary/20 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Restaurant promotion</p>
          <h4 className="mt-2 font-display text-2xl">{p.title}</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{p.message}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Offer ends {new Date(p.endsAt).toLocaleDateString("en-TH")}
          </p>
        </article>)}
      </div>
    </section>:null}
  </section>;
}
