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
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          {dish.photo_url ? (
            <img src={dish.photo_url} alt={name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <span className="font-display text-4xl">🍜</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-semibold leading-tight">{name}</h3>
            {dish.price_thb != null && (
              <span className="shrink-0 text-sm font-medium text-foreground/70">฿{Number(dish.price_thb).toFixed(0)}</span>
            )}
          </div>
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {dish.place?.name}{areaName ? ` · ${areaName}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneCls}`}>{s.text}</span>
            <span className="text-xs text-muted-foreground">{t("compared_by")} {dish.comparisons_count} · {t("added_ago")} {days}{days === 1 ? "d" : "d"}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}