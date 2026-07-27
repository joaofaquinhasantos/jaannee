import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";
import { ShareButton } from "@/components/ShareButton";

/**
 * Editorial leaderboard entry. Presentation only — every number shown here is
 * real data already loaded for the dish (Elo ordering position,
 * comparisons_count, tried_count, price). No derived or invented stats.
 */
export function LeaderboardEntry({
  dish,
  rank,
  featured = false,
}: {
  dish: any;
  rank?: number;
  featured?: boolean;
}) {
  const { t, lang } = useI18n();
  const primaryName = lang === "th" && dish.name_th ? dish.name_th : dish.name_en;
  const secondaryName = lang === "th" && dish.name_th ? dish.name_en : dish.name_th;
  const areaName = dish.place?.area
    ? lang === "th"
      ? dish.place.area.name_th
      : dish.place.area.name_en
    : null;
  const comparisons = dish.comparisons_count ?? 0;
  const tried = dish.tried_count ?? 0;
  const isRanked = comparisons >= PUBLIC_RANK_THRESHOLD;
  const showRank = isRanked && rank != null;
  const numeral = rank != null ? String(rank).padStart(2, "0") : null;

  return (
    <article className="relative">
      {showRank ? (
        <span
          aria-hidden="true"
          className={`rank-numeral pointer-events-none absolute -top-4 left-0 z-0 ${
            featured ? "text-[9rem] md:text-[13rem]" : "text-[6rem] md:text-[8rem]"
          }`}
        >
          {numeral}
        </span>
      ) : null}

      <div
        className={`relative z-10 ${showRank ? (featured ? "pl-10 pt-14 md:pl-24 md:pt-20" : "pl-8 pt-10 md:pl-16 md:pt-12") : ""}`}
      >
        <Link
          to="/dish/$id"
          params={{ id: dish.id }}
          className="group block focus-visible:rounded-sm"
        >
          <div
            className={`relative w-full overflow-hidden border-2 border-foreground bg-muted ${featured ? "aspect-[4/3] md:aspect-[16/9]" : "aspect-[4/3]"}`}
          >
            {dish.photo_url ? (
              <img
                src={dish.photo_url}
                alt={primaryName}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-secondary text-muted-foreground">
                <span className="font-display text-3xl italic opacity-70">Photo needed</span>
                <span className="label-caps mt-2 opacity-70">Help this dish look alive</span>
              </div>
            )}
            <div className="photo-scrim pointer-events-none absolute inset-0" />

            {!isRanked ? (
              <span className="label-caps absolute left-3 top-3 rounded-full bg-ink/75 px-3 py-1.5 text-paper backdrop-blur">
                {t("gathering_progress")} · {comparisons}/{PUBLIC_RANK_THRESHOLD}
              </span>
            ) : null}
            {dish.price_thb != null ? (
              <span className="label-caps absolute right-3 top-3 border border-white/30 bg-black/75 px-3 py-1.5 text-white backdrop-blur">
                THB {Number(dish.price_thb).toFixed(0)}
              </span>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
              <h3
                className={`font-display leading-[0.9] text-white drop-shadow-sm ${featured ? "text-4xl md:text-6xl" : "text-3xl md:text-4xl"}`}
              >
                {primaryName}
              </h3>
              {secondaryName ? (
                <p className="mt-1 line-clamp-1 font-thai text-base font-medium text-white/85">
                  {secondaryName}
                </p>
              ) : null}
              <p className="label-caps mt-2 text-white/80">
                {dish.place?.name}
                {areaName ? ` · ${areaName}` : ""}
              </p>
            </div>
          </div>
        </Link>

        {/* Stats strip — real values only */}
        <div className="mt-0 flex flex-wrap items-center gap-x-6 gap-y-2 border-x-2 border-b-2 border-foreground bg-card px-4 py-3">
          <Stat value={String(comparisons)} label={t("comparisons_progress")} />
          {tried > 0 ? <Stat value={String(tried)} label={t("diners")} /> : null}
          {showRank ? (
            <span className="label-caps rounded-full border border-gold/60 bg-gold/10 px-3 py-1 text-ink">
              {t("trusted_rank")}
            </span>
          ) : null}
          <span className="ml-auto">
            <ShareButton
              url={
                (typeof window !== "undefined" ? window.location.origin : "") + `/dish/${dish.id}`
              }
              title={dish.name_en ?? dish.name_th ?? "Dish"}
              text={`${dish.place?.name ?? ""}${dish.price_thb != null ? ` / THB ${Number(dish.price_thb).toFixed(0)}` : ""}${showRank ? ` / Currently ranked #${rank}` : ""}`}
              label={t("share")}
            />
          </span>
        </div>
      </div>
    </article>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-display text-2xl leading-none text-ink">{value}</span>
      <span className="label-caps text-muted-foreground">{label}</span>
    </span>
  );
}
