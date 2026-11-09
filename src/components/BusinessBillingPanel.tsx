import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Crown, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  beginBusinessSubscription,
  getBusinessBillingState,
  openBusinessBillingPortal,
} from "@/lib/restaurant-billing.functions";

export function BusinessBillingPanel({businessId}:{businessId:string}) {
  const q=useQuery({
    queryKey:["business-billing",businessId],
    queryFn:()=>getBusinessBillingState({data:{businessId}}),
    enabled:Boolean(businessId),
    retry:false,
  });
  const subscribe=useMutation({
    mutationFn:(tier:"pro"|"growth")=>beginBusinessSubscription({data:{businessId,tier}}),
    onSuccess:({url})=>{window.location.assign(url);},
    onError:(error:Error)=>toast.error(error.message),
  });
  const portal=useMutation({
    mutationFn:()=>openBusinessBillingPortal({data:{businessId}}),
    onSuccess:({url})=>{window.location.assign(url);},
    onError:(error:Error)=>toast.error(error.message),
  });
  const active=["active","trialing"].includes(q.data?.status??"");
  const configured=q.data?.configured===true;

  return <section className="space-y-5 border border-border p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
          <CreditCard size={17}/> Business subscription
        </p>
        <h2 className="mt-2 font-display text-3xl">Free, Pro or Growth</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Basic pages and menus are free. Pro is for assisted multilingual menus;
          Growth adds customer engagement. Paid upgrades are activated only by
          Stripe-confirmed subscriptions, never by selecting a plan in the browser.
        </p>
      </div>
      <span className="border border-border px-3 py-2 text-xs font-bold uppercase">
        {q.data?.tier??"Free"} · {q.data?.status??"unavailable"}
      </span>
    </div>

    {q.isLoading?<p className="text-xs text-muted-foreground">Checking billing availability…</p>:null}
    {q.isError?<p className="border-l-2 border-amber-400 p-3 text-xs leading-6 text-muted-foreground">
      Billing status cannot be verified while the database is unavailable.
      No payment will be initiated.
    </p>:null}
    {!configured?<p className="border-l-2 border-primary bg-secondary/20 p-3 text-xs leading-6 text-muted-foreground">
      Subscriptions are not yet enabled. Prices are proposals until approved
      and configured in Stripe. No card details or payment requests can be collected here.
    </p>:null}

    <div className="grid gap-3 sm:grid-cols-3">
      {[
        {tier:"free",label:"Free",description:"Business page, manual menu, basic QR"},
        {tier:"pro",label:"Pro",description:"AI-assisted multilingual menu and branded QR"},
        {tier:"growth",label:"Growth",description:"Pro tools plus consent-based retention features"},
      ].map((item)=><div key={item.tier} className="flex flex-col gap-4 border border-border p-4">
        <div>
          <h3 className="font-display text-3xl">{item.label}</h3>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.description}</p>
        </div>
        <div className="mt-auto">
          {item.tier==="free"?<span className="text-xs font-semibold">฿0 / month</span>:
            <Button variant="outline" className="w-full"
              disabled={!configured||active||subscribe.isPending||q.isError}
              onClick={()=>subscribe.mutate(item.tier as "pro"|"growth")}>
              <Crown size={16} className="mr-2"/> View Stripe checkout
            </Button>}
        </div>
      </div>)}
    </div>
    {active?<Button variant="outline" disabled={!configured||portal.isPending}
      onClick={()=>portal.mutate()}><ExternalLink size={16} className="mr-2"/> Manage billing in Stripe</Button>:null}
    <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
      <ShieldCheck size={16} className="mt-0.5 shrink-0"/> Paid features turn on only after signed subscription
      events are processed successfully. A successful Checkout redirect alone never grants access.
    </p>
  </section>;
}
