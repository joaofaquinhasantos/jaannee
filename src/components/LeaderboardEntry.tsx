import { Link } from "@tanstack/react-router";
import { RankingShare } from "@/components/RankingShare";
import { useI18n } from "@/lib/i18n";
import { localizedName, secondaryName } from "@/lib/names";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";
import type { ShareDish } from "@/lib/share-card";

type LeaderboardDish = ShareDish & {
  price_thb?: number | null;
  tried_count?: number | null;
  place?: {
    name?: string | null;
    area?: { name_en?: string | null; name_th?: string | null } | null;
  } | null;
};

/** Editorial leaderboard entry using only real ranking and diner data. */
export function LeaderboardEntry({
  dish,
  rank,
  featured = false,
}: {
  dish: LeaderboardDish;
  rank?: number;
  featured?: boolean;
}) {
  const { t, lang } = useI18n();
  const primaryName = localizedName(dish, lang);
  const alternateName = secondaryName(dish, lang);
  const areaName = localizedName(dish.place?.area, lang);
  const comparisons = Number(dish.comparisons_count ?? 0);
  const tried = Number(dish.tried_count ?? 0);
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
        className={`relative z-10 ${
          showRank
            ? featured
              ? "pl-10 pt-14 md:pl-24 md:pt-20"
              : "pl-8 pt-10 md:pl-16 md:pt-12"
            : ""
        }`}
      >
        <Link
          to="/dish/$id"
          params={{ id: dish.id }}
          className="group block focus-visible:rounded-sm"
        >
          <div
            className={`relative w-full overflow-hidden border-2 border-foreground bg-muted ${
              featured ? "aspect-[4/3] md:aspect-[16/9]" : "aspect-[4/3]"
            }`}
          >
            {dish.photo_url ? (
              <img
                src={dish.photo_url}
                alt={primaryName}
                width={1200}
                height={900}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-secondary text-muted-foreground">
                <span className="type-card-title opacity-70">{t("photo_needed")}</span>
                <span className="label-caps mt-2 opacity-70">{t("photo_needed_body")}</span>
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
                className={`text-white drop-shadow-sm ${featured ? "type-page-title" : "type-card-title"}`}
              >
                {primaryName}
              </h3>
              {alternateName ? (
                <p className="mt-1 line-clamp-1 font-thai text-base font-medium text-white/85">
                  {alternateName}
                </p>
              ) : null}
              <p className="label-caps mt-2 text-white/80">
                {dish.place?.name}
                {areaName ? ` · ${areaName}` : ""}
              </p>
            </div>
          </div>
        </Link>

        <div className="mt-0 flex flex-wrap items-center gap-x-6 gap-y-3 border-x-2 border-b-2 border-foreground bg-card px-4 py-3">
          <Stat value={String(comparisons)} label={t("comparisons_progress")} />
          {tried > 0 ? <Stat value={String(tried)} label={t("diners")} /> : null}
          {showRank ? (
            <span className="label-caps rounded-full border border-gold/60 bg-gold/10 px-3 py-1 text-ink">
              {t("trusted_rank")}
            </span>
          ) : null}
          {showRank ? (
            <span className="ml-auto">
              <RankingShare dish={dish} rank={rank} />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="type-stat text-ink">{value}</span>
      <span className="label-caps text-muted-foreground">{label}</span>
    </span>
  );
}
