import { createFileRoute,Link } from "@tanstack/react-router";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { Gift,Ticket,ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  claimFollowerVoucher,listMyFollowerOffers,listMyVoucherClaims,
} from "@/lib/restaurant-growth.functions";
import { useAuthUser } from "@/lib/use-auth";

export const Route=createFileRoute("/_authenticated/offers")({
  head:()=>({meta:[{title:"My restaurant offers · JaanNee"},{name:"robots",content:"noindex,nofollow"}]}),
  component:MyRestaurantOffers,
});

function MyRestaurantOffers(){
  const {userId}=useAuthUser();
  const qc=useQueryClient();
  const offers=useQuery({
    queryKey:["opt-in-restaurant-offers",userId],
    queryFn:()=>listMyFollowerOffers(),
    enabled:Boolean(userId),retry:false,
  });
  const vouchers=useQuery({
    queryKey:["my-restaurant-vouchers",userId],
    queryFn:()=>listMyVoucherClaims(),
    enabled:Boolean(userId),retry:false,
  });
  const claim=useMutation({
    mutationFn:(campaignId:string)=>claimFollowerVoucher({data:{campaignId}}),
    onSuccess:async()=>{
      await qc.invalidateQueries({queryKey:["my-restaurant-vouchers"]});
      toast.success("Voucher added to your account");
    },
    onError:(error:Error)=>toast.error(error.message),
  });
  const claimed=new Set((vouchers.data??[]).map((item:any)=>item.campaign_id));
  return <AppShell tone="noir">
    <main className="mx-auto max-w-4xl space-y-8 pb-16">
      <header className="border-b border-border pb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Restaurant rewards</p>
        <h1 className="mt-2 font-display text-4xl">My offers and vouchers</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          See vouchers from restaurants you follow and have explicitly allowed
          to show you voucher offers. Following never automatically opts you into marketing.
          You can change these preferences on each restaurant page.
        </p>
      </header>
      {offers.isLoading||vouchers.isLoading?<p className="text-sm text-muted-foreground">Loading your offers…</p>:null}
      {offers.isError||vouchers.isError?<p role="alert" className="border border-border p-4 text-sm text-muted-foreground">
        Offers are temporarily unavailable while the database is restricted.
      </p>:null}
      <section>
        <h2 className="flex items-center gap-2 font-display text-3xl"><Gift size={23} className="text-primary"/> Available offers</h2>
        {!(offers.data??[]).length&&!offers.isLoading?<p className="mt-4 text-sm text-muted-foreground">
          No currently active voucher offers from restaurants you opted in to.
        </p>:null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(offers.data??[]).map((item:any)=><article key={item.id} className="border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{item.restaurant}</p>
            <h3 className="mt-2 font-display text-2xl">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.message}</p>
            <p className="mt-3 text-sm font-semibold">{item.discountPercent}% discount</p>
            <p className="mt-1 text-xs text-muted-foreground">Ends {new Date(item.endsAt).toLocaleDateString("en-TH")}</p>
            <Button className="mt-4" disabled={claimed.has(item.id)||claim.isPending}
              onClick={()=>claim.mutate(item.id)}>{claimed.has(item.id)?"Already claimed":"Claim voucher"}</Button>
          </article>)}
        </div>
      </section>
      <section>
        <h2 className="flex items-center gap-2 font-display text-3xl"><Ticket size={23} className="text-primary"/> My vouchers</h2>
        {!(vouchers.data??[]).length&&!vouchers.isLoading?<p className="mt-4 text-sm text-muted-foreground">
          No vouchers claimed yet.
        </p>:null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(vouchers.data??[]).map((item:any)=>{
            const expired=Date.parse(item.expires_at)<=Date.now();
            const used=Boolean(item.redeemed_at);
            return <article key={item.id} className="border border-border p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{item.title}</p>
              <p className="mt-2 font-mono text-xl font-bold">{item.claim_code}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {used?"Redeemed":expired?"Expired":"Active · Present the code to staff"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Expires {new Date(item.expires_at).toLocaleDateString("en-TH")}</p>
              <p className="mt-3 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
                <ShieldCheck size={16} className="mt-1 shrink-0"/> This is a single-use
                restaurant voucher; staff must confirm redemption.
              </p>
            </article>;
          })}
        </div>
      </section>
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">
        Discover more dishes
      </Link>
    </main>
  </AppShell>;
}
