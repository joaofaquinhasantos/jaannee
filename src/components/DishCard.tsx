import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { dishStatusLabel, toneClass } from "@/lib/dish-status";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

export const statusLabel = dishStatusLabel;
export { toneClass };

export function DishCard({
  dish,
  rank,
  linkToDetail = true,
}: {
  dish: any;
  rank?: number;
  linkToDetail?: boolean;
}) {
  const { t, lang } = useI18n();
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(dish.created_at).getTime()) / 86400000),
  );
  const s = statusLabel(dish, t);
  const primaryName = lang === "th" && dish.name_th ? dish.name_th : dish.name_en;
  const secondaryName = lang === "th" && dish.name_th ? dish.name_en : dish.name_th;
  const areaName = dish.place?.area
    ? lang === "th"
      ? dish.place.area.name_th
      : dish.place.area.name_en
    : null;
  const toneCls = toneClass(s.tone);
  const comparisonCount = dish.comparisons_count ?? 0;
  const triedCount = dish.tried_count ?? 0;
  const isRanked = comparisonCount >= PUBLIC_RANK_THRESHOLD;
  const showRank = isRanked && rank != null;
  const moderationStatus =
    dish.status === "pending"
      ? lang === "th"
        ? "เผยแพร่แล้ว · รอตรวจสอบ"
        : "Live · awaiting review"
      : dish.status === "rejected"
        ? "Not approved"
        : null;

  const card = (
    <div className="group block">
      <article className="editorial-frame overflow-hidden transition-colors duration-200 group-hover:border-primary/70">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted sm:aspect-[4/3]">
          {dish.photo_url ? (
            <img
              src={dish.photo_url}
              alt={primaryName}
              className="h-full w-full object-cover saturate-[0.9] transition duration-700 group-hover:scale-[1.025] group-hover:saturate-100"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-secondary text-muted-foreground">
              <span className="type-card-title opacity-70">Photo needed</span>
              <span className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                Help this dish look alive
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/5" />
          {moderationStatus ? (
            <span className="absolute left-3 top-3 inline-flex items-center bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              {moderationStatus}
            </span>
          ) : showRank ? (
            <div className="absolute left-4 top-4 flex items-start gap-2 text-gold">
              <span className="brand-serif text-7xl leading-[0.75] drop-shadow-sm">{rank}</span>
              <span className="mt-1 h-8 border-l border-gold/60" aria-hidden="true" />
            </div>
          ) : (
            <span
              className={`absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur ${toneCls}`}
            >
              {isRanked
                ? s.text
                : `${t("unranked_label")} · ${comparisonCount}/${PUBLIC_RANK_THRESHOLD}`}
            </span>
          )}
          {dish.price_thb != null && (
            <span className="absolute right-3 top-3 inline-flex items-center border border-white/30 bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
              THB {Number(dish.price_thb).toFixed(0)}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="brand-serif text-[2.25rem] leading-[0.95] text-white drop-shadow-sm sm:text-[2.5rem]">
              {primaryName}
            </h3>
            {secondaryName ? (
              <p className="mt-1 line-clamp-1 font-thai text-base font-medium leading-tight text-white/90">
                {secondaryName}
              </p>
            ) : null}
            <p className="mt-0.5 line-clamp-1 text-sm text-white/85">
              {dish.place?.name}
              {areaName ? ` / ${areaName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex min-h-16 items-center justify-between gap-2 border-t border-white/10 px-4 py-3.5">
          <div className="space-y-1">
            {moderationStatus ? (
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                {dish.status === "pending"
                  ? lang === "th"
                    ? "โพสต์นี้เผยแพร่แล้ว ผู้ดูแลจะตรวจสอบภายหลัง"
                    : "This post is public. Admin review follows."
                  : "This submission is not public"}
              </p>
            ) : (
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                {comparisonCount} / {PUBLIC_RANK_THRESHOLD} {t("comparisons_progress")}
              </p>
            )}
            {triedCount > 0 && (
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                {t("tried_by")} {triedCount} {t(triedCount === 1 ? "diner" : "diners")}
              </p>
            )}
          </div>
          <span className="text-[11px] font-semibold uppercase text-muted-foreground">
            {t("added_ago")} {days}d
          </span>
        </div>
      </article>
    </div>
  );

  if (!linkToDetail) return card;

  return (
    <Link to="/dish/$id" params={{ id: dish.id }} className="focus-visible:rounded-lg">
      {card}
    </Link>
  );
}
