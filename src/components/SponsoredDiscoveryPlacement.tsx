import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BadgeCheck, Megaphone } from "lucide-react";
import { listSponsoredDiscovery } from "@/lib/sponsored-boosts.functions";

/**
 * Explicitly segregated from organic dish discovery, Elo and trusted picks.
 * Fail silently when no approved paid sponsorship exists, or DB is offline.
 */
export function SponsoredDiscoveryPlacement({
  categorySlug, areaSlug,
}: { categorySlug?:string;areaSlug?:string }) {
  const ad=useQuery({
    queryKey:["sponsored-discovery",categorySlug??"",areaSlug??""],
    queryFn:()=>listSponsoredDiscovery({data:{categorySlug,areaSlug}}),
    retry:false,
    staleTime:5*60_000,
    refetchOnWindowFocus:false,
  });
  const result=ad.data;
  if(!result?.restaurantSlug)return null;
  return <aside aria-label="Paid restaurant advertisement"
    className="border-y border-primary/30 bg-[#221b19] px-5 py-5 md:px-8">
    <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 border border-amber-400/50 bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.17em] text-amber-300">
          <Megaphone size={14} aria-hidden="true"/> Sponsored
        </p>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-white/65">{result.restaurantName}</p>
        <h2 className="mt-2 font-display text-2xl uppercase leading-tight text-white sm:text-3xl">
          {result.headline}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">{result.body}</p>
        <p className="mt-3 flex items-center gap-2 text-[11px] text-white/55">
          <BadgeCheck size={15} aria-hidden="true"/>
          Paid restaurant promotion — not a diner recommendation or ranking
        </p>
      </div>
      <Link to="/menu/$slug" params={{slug:result.restaurantSlug}}
        className="inline-flex min-h-12 items-center justify-center gap-2 border border-amber-300 px-5 py-2 text-sm font-bold text-white transition hover:bg-white/10">
        Restaurant menu <ArrowUpRight size={17} aria-hidden="true"/>
      </Link>
    </div>
  </aside>;
}
