import { useQuery } from "@tanstack/react-query";
import { Heart, Megaphone, ShieldCheck, Ticket, Users } from "lucide-react";
import { getRestaurantAudienceSummary } from "@/lib/restaurant-audience.functions";

const metrics=[
  {key:"followers",label:"Restaurant followers",note:"People who chose to follow this business",Icon:Users},
  {key:"voucherOptIns",label:"Voucher opt-ins",note:"Followers who explicitly allowed voucher offers",Icon:Ticket},
  {key:"announcementOptIns",label:"Announcement opt-ins",note:"Followers who explicitly allowed announcements",Icon:Megaphone},
  {key:"activeCampaigns",label:"Active campaigns",note:"Published business-authored offers",Icon:Heart},
  {key:"loyaltyMembers",label:"Loyalty members",note:"Diners enrolled in your loyalty program",Icon:ShieldCheck},
] as const;

export function BusinessAudiencePanel({businessId}:{businessId:string}){
  const q=useQuery({
    queryKey:["restaurant-audience-summary",businessId],
    queryFn:()=>getRestaurantAudienceSummary({data:{businessId}}),
    enabled:Boolean(businessId),retry:false,staleTime:60_000,
  });
  return <section className="space-y-5 border border-border p-5 sm:p-7">
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Restaurant community</p>
      <h2 className="mt-2 font-display text-3xl">Your audience</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Real Jaannee activity, aggregated to protect diners. Following never grants
        marketing permission. These figures are not estimates, paid reach or POS statistics.
      </p>
    </div>
    {q.isLoading?<p className="text-xs text-muted-foreground" role="status">Loading verified audience totals…</p>:null}
    {q.isError?<p className="border-l-2 border-amber-400 p-4 text-xs leading-6 text-muted-foreground" role="alert">
      Audience statistics are unavailable while verification or database access is restricted.
      We will not display invented figures.
    </p>:null}
    {q.data?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map(({key,label,note,Icon})=><article key={key} className="border border-border bg-secondary/20 p-4">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Icon size={17} className="text-primary"/>{label}
        </p>
        <p className="mt-3 font-display text-4xl font-semibold tabular-nums">
          {q.data[key].toLocaleString("en-TH")}
        </p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">{note}</p>
      </article>)}
    </div>:null}
    <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
      <ShieldCheck size={16} className="mt-0.5 shrink-0"/>
      Consent is recorded individually but the business workspace shows only totals.
      There is no unrequested mass messaging, email export or automatic notification blast.
    </p>
  </section>;
}
