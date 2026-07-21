import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { dishStatusLabel, toneClass } from "@/lib/dish-status";

export const statusLabel = dishStatusLabel;
export { toneClass };

export function DishCard({ dish, rank }: { dish: any; rank?: number }) {
  const { t, lang } = useI18n();
  const days = Math.max(0, Math.floor((Date.now() - new Date(dish.created_at).getTime()) / 86400000));
  const s = statusLabel(dish, t);
  const primaryName = lang === "th" && dish.name_th ? dish.name_th : dish.name_en;
  const secondaryName = lang === "th" && dish.name_th ? dish.name_en : dish.name_th;
  const areaName = dish.place?.area ? (lang === "th" ? dish.place.area.name_th : dish.place.area.name_en) : null;
  const toneCls = toneClass(s.tone);
  const isRanked = (dish.comparisons_count ?? 0) >= 5;
  const showRank = isRanked && rank != null;

  return (
    <Link to="/dish/$id" params={{ id: dish.id }} className="group block focus-visible:rounded-lg">
      <article className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_18px_45px_rgba(42,30,36,0.06)] transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-[0_22px_60px_rgba(42,30,36,0.1)]">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {dish.photo_url ? (
            <img
              src={dish.photo_url}
              alt={primaryName}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground">
              <span className="font-display text-4xl italic">JaanNee</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          {showRank ? (
            <div className="absolute left-4 top-4 flex items-start gap-2 text-white">
              <span className="font-display text-6xl leading-[0.8] drop-shadow-sm">{rank}</span>
              <span className="mt-1 h-8 border-l border-white/45" aria-hidden="true" />
            </div>
          ) : (
            <span className={`absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur ${toneCls}`}>
              {s.text}
            </span>
          )}
          {dish.price_thb != null && (
            <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
              THB {Number(dish.price_thb).toFixed(0)}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="font-display text-2xl leading-none text-white drop-shadow-sm">{primaryName}</h3>
            {secondaryName ? (
              <p className="mt-1 line-clamp-1 font-thai text-base font-medium leading-tight text-white/90">
                {secondaryName}
              </p>
            ) : null}
            <p className="mt-0.5 line-clamp-1 text-sm text-white/85">
              {dish.place?.name}{areaName ? ` / ${areaName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3.5">
          <span className="text-[11px] font-semibold uppercase text-muted-foreground">
            {t("compared_by")} {dish.comparisons_count}
          </span>
          <span className="text-[11px] font-semibold uppercase text-muted-foreground">
            {t("added_ago")} {days}d
          </span>
        </div>
      </article>
    </Link>
  );
}
