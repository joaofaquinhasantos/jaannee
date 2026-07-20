import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { listAreas, listCategories, leaderboard } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { DishCard } from "@/components/DishCard";
import { ShareButton } from "@/components/ShareButton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/rankings")({
  head: () => ({ meta: [{ title: "Rankings — JaanNee" }] }),
  component: Rankings,
});

function Rankings() {
  const { t, lang } = useI18n();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });
  const [cat, setCat] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();

  useEffect(() => {
    if (!cat && categories.data && categories.data.length > 0)
      setCat((categories.data[0] as any).slug);
  }, [categories.data, cat]);

  const board = useQuery({
    queryKey: ["leaderboard", cat, area],
    queryFn: () =>
      leaderboard({ data: { categorySlug: cat!, areaSlug: area, minimumComparisons: 0 } }),
    enabled: !!cat,
  });

  return (
    <AppShell>
      <h1 className="font-display text-4xl font-semibold">{t("nav_rankings")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("rankings_intro")}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(categories.data ?? []).map((c: any) => (
          <button
            key={c.id}
            onClick={() => setCat(c.slug)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${cat === c.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground/70 hover:bg-muted"}`}
          >
            {lang === "th" ? c.name_th : c.name_en}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setArea(undefined)}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${!area ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-foreground/70"}`}
        >
          {t("filter_all_areas")}
        </button>
        {(areas.data ?? []).map((a: any) => (
          <button
            key={a.id}
            onClick={() => setArea(a.slug)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${area === a.slug ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-foreground/70"}`}
          >
            {lang === "th" ? a.name_th : a.name_en}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {(board.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <h2 className="font-display text-2xl font-semibold">{t("empty_rankings_title")}</h2>
            <p className="mt-2 text-muted-foreground">{t("empty_rankings_body")}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link to="/submit">
                <Button>{t("cta_add")}</Button>
              </Link>
              <Link to="/compare">
                <Button variant="outline">{t("cta_compare")}</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(board.data ?? []).map((d: any, i: number) => (
              <div key={d.id} className="relative">
                <span className="absolute -left-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground shadow">
                  {i + 1}
                </span>
                <DishCard dish={d} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${d.comparisons_count >= 5 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                  >
                    {d.comparisons_count >= 5 ? t("trusted_rank") : t("provisional")}
                  </span>
                  <ShareButton
                    url={
                      (typeof window !== "undefined" ? window.location.origin : "") +
                      `/dish/${d.id}`
                    }
                    title={d.name_en ?? d.name_th ?? "Dish"}
                    text={`${d.place?.name ?? ""}${d.price_thb != null ? ` · ฿${Number(d.price_thb).toFixed(0)}` : ""} · Currently ranked #${i + 1}`}
                    label={t("share")}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
