import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { dishStatusLabel, toneClass } from "@/lib/dish-status";

export const statusLabel = dishStatusLabel;
export { toneClass };

export function DishCard({ dish }: { dish: any }) {
  const { t, lang } = useI18n();
  const days = Math.max(0, Math.floor((Date.now() - new Date(dish.created_at).getTime()) / 86400000));
  const s = statusLabel(dish, t);
  const name = lang === "th" && dish.name_th ? dish.name_th : dish.name_en;
  const areaName = dish.place?.area ? (lang === "th" ? dish.place.area.name_th : dish.place.area.name_en) : null;
  const toneCls = toneClass(s.tone);

  return (
    <Link to="/dish/$id" params={{ id: dish.id }} className="group block">
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {dish.photo_url ? (
            <img src={dish.photo_url} alt={name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <span className="font-display text-4xl">🍜</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <span className={`absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur ${toneCls}`}>
            {s.text}
          </span>
          {dish.price_thb != null && (
            <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
              ฿{Number(dish.price_thb).toFixed(0)}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="font-display text-xl font-semibold leading-tight text-white drop-shadow-sm">{name}</h3>
            <p className="mt-0.5 line-clamp-1 text-sm text-white/85">
              {dish.place?.name}{areaName ? ` · ${areaName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("compared_by")} {dish.comparisons_count}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("added_ago")} {days}d
          </span>
        </div>
      </article>
    </Link>
  );
}