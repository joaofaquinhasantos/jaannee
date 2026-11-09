import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import type { PublicPick } from "@/lib/recommendations.functions";
import { localizedName } from "@/lib/names";

export function PublicPickGrid({
  picks,
  lang,
  emptyText,
}: {
  picks: PublicPick[];
  lang: "en" | "th";
  emptyText: string;
}) {
  if (!picks.length) {
    return <p className="border border-white/10 bg-white/[0.035] p-5 text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {picks.map((pick) => (
        <Link
          to="/dish/$id"
          params={{ id: pick.dish.id }}
          key={pick.dish_id}
          className="group overflow-hidden border border-border bg-card transition-colors hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {pick.dish.photo_url ? (
              <img src={pick.dish.photo_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-lg font-semibold">
                {localizedName(pick.dish, lang)}
              </div>
            )}
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 bg-black/80 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
              <Heart size={12} fill="currentColor" aria-hidden="true" />
              {lang === "th" ? "แนะนำ" : "Recommended"}
            </span>
          </div>
          <div className="p-4">
            <h3 className="font-semibold leading-snug">{localizedName(pick.dish, lang)}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">{pick.dish.place?.name}</p>
            {pick.note ? <p className="mt-3 border-l-2 border-primary pl-3 text-sm leading-relaxed">{pick.note}</p> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
