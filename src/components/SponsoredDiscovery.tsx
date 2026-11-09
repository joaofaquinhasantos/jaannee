import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Megaphone, ShieldCheck } from "lucide-react";
import { listSponsoredDiscovery } from "@/lib/sponsored-boosts.functions";

/**
 * Paid exposure is separate from the dish leaderboard and trust feed.
 * No sponsored card is ever inserted into ranking arrays or user picks.
 */
export function SponsoredDiscovery({
  categorySlug,areaSlug,
}:{categorySlug?:string;areaSlug?:string}) {
  const ad=useQuery({
    queryKey:["sponsored-discovery",categorySlug??null,areaSlug??null],
    queryFn:()=>listSponsoredDiscovery({data:{categorySlug,areaSlug}}),
    retry:false,
    staleTime:60_000,
  });
  if(!ad.data)return null;
  const item=ad.data;
  if(!item.restaurantSlug)return null;
  return <section aria-label="Paid restaurant promotion" className="border-y border-[#c18b3e]/20 bg-[#211c17] px-5 py-7 md:px-8">
    <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-5 border border-amber-400/25 p-5 sm:p-7">
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.13em] text-amber-200">
          <Megaphone size={15}/>{item.disclosure} · Paid placement
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight text-white sm:text-4xl">{item.headline}</h2>
        <p className="mt-2 text-sm leading-7 text-white/70">{item.body}</p>
        <p className="mt-3 text-xs text-white/55">
          {item.restaurantName} · Restaurant-authored content, not a diner recommendation
        </p>
        <p className="mt-2 inline-flex items-center gap-2 text-[11px] text-white/45">
          <ShieldCheck size={14}/> Sponsored cards do not affect dish rankings.
        </p>
      </div>
      <Link to="/menu/$slug" params={{slug:item.restaurantSlug}}
        className="inline-flex min-h-12 shrink-0 items-center gap-3 border border-amber-300/50 px-5 text-xs font-bold uppercase tracking-wider text-amber-100 hover:bg-white/10">
        View restaurant menu <ArrowUpRight size={17}/>
      </Link>
    </div>
  </section>;
}
