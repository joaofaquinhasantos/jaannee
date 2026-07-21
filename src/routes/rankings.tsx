import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { listAreas, listCategories, listCategoryCounts, listDishes, leaderboard } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { DishCard } from "@/components/DishCard";
import { ShareButton } from "@/components/ShareButton";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/CategoryPicker";
import { AreaPicker } from "@/components/AreaPicker";

export const Route = createFileRoute("/rankings")({
  head: () => ({ meta: [{ title: "Rankings - JaanNee" }] }),
  component: Rankings,
});

function Rankings() {
  const { t, lang } = useI18n();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const categoryCounts = useQuery({ queryKey: ["category-counts"], queryFn: () => listCategoryCounts() });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });
  const allDishes = useQuery({ queryKey: ["dishes", "area-counts"], queryFn: () => listDishes({ data: {} }) });
  const [cat, setCat] = useState<string | undefined>();
  const [subtype, setSubtype] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();

  useEffect(() => {
    if (!cat && categories.data && categories.data.length > 0)
      setCat((categories.data[0] as any).slug);
  }, [categories.data, cat]);

  const board = useQuery({
    queryKey: ["leaderboard", cat, subtype, area],
    queryFn: () =>
      leaderboard({ data: { categorySlug: cat!, subtypeSlug: subtype, areaSlug: area, minimumComparisons: 5 } }),
    enabled: !!cat,
  });
  const unranked = useQuery({
    queryKey: ["rankings-unranked", cat, subtype, area],
    queryFn: () => listDishes({ data: { categorySlug: cat, subtypeSlug: subtype, areaSlug: area } }),
    enabled: !!cat && (!subtypes.length || !!subtype),
  });

  const selectedCat = (categories.data ?? []).find((c: any) => c.slug === cat) as any;
  const subtypes = ((selectedCat?.subtypes ?? []) as any[]).sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name_en.localeCompare(b.name_en),
  );
  const topCategories = [...(categories.data ?? [])]
    .sort((a: any, b: any) => (categoryCounts.data?.[b.id] ?? 0) - (categoryCounts.data?.[a.id] ?? 0) || a.name_en.localeCompare(b.name_en))
    .slice(0, 8);
  const areaCounts = new Map<string, number>();
  for (const dish of allDishes.data ?? []) {
    const areaId = (dish as any).place?.area?.id;
    if (areaId) areaCounts.set(areaId, (areaCounts.get(areaId) ?? 0) + 1);
  }
  const topAreas = [...(areas.data ?? [])]
    .filter((a: any) => (areaCounts.get(a.id) ?? 0) > 0)
    .sort((a: any, b: any) => (areaCounts.get(b.id) ?? 0) - (areaCounts.get(a.id) ?? 0) || a.name_en.localeCompare(b.name_en))
    .slice(0, 6);
  const gatheringDishes = ((unranked.data ?? []) as any[])
    .filter((dish) => (dish.comparisons_count ?? 0) < 5)
    .sort(
      (a, b) =>
        (b.tried_count ?? 0) - (a.tried_count ?? 0) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  return (
    <AppShell>
      <section className="border-b border-border pb-7">
        <p className="text-xs font-bold uppercase text-primary">Live chart</p>
        <div className="mt-3 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="font-display text-5xl leading-none md:text-7xl">{t("nav_rankings")}</h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{t("rankings_intro")}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <span className="font-display text-6xl leading-none text-accent">#</span>
            <p className="mt-2 text-xs font-bold uppercase text-muted-foreground">Rank is earned</p>
          </div>
        </div>
      </section>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {topCategories.map((c: any) => (
          <button
            key={c.id}
            onClick={() => {
              setCat(c.slug);
              setSubtype(undefined);
            }}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${cat === c.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
          >
            {lang === "th" ? c.name_th : c.name_en}
          </button>
        ))}
        <div className="min-w-48">
          <CategoryPicker
            categories={categories.data ?? []}
            value={cat}
            lang={lang}
            placeholder={t("filter_all_categories")}
            triggerLabel={cat ? t("change_category") : t("more_categories")}
            onChange={(_, category) => {
              setCat(category.slug);
              setSubtype(undefined);
            }}
          />
        </div>
      </div>
      {subtypes.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          {subtypes.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSubtype(s.slug)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${subtype === s.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {lang === "th" ? s.name_th : s.name_en}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setArea(undefined)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${!area ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
        >
          {t("filter_all_areas")}
        </button>
        {topAreas.map((a: any) => (
          <button
            key={a.id}
            onClick={() => setArea(a.slug)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${area === a.slug ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {lang === "th" ? a.name_th : a.name_en}
          </button>
        ))}
        <div className="min-w-36">
          <AreaPicker areas={areas.data ?? []} value={area} lang={lang} onChange={(slug) => setArea(slug)} />
        </div>
      </div>

      <div className="mt-7">
        {subtypes.length > 0 && !subtype ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subtypes.map((s: any, i: number) => (
              <button
                key={s.id}
                onClick={() => setSubtype(s.slug)}
                className="rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/40"
              >
                <span className="font-display text-5xl leading-none text-accent">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="mt-4 font-display text-3xl leading-tight">{lang === "th" ? s.name_th : s.name_en}</h2>
                <p className="mt-2 text-sm text-muted-foreground">Rank this dish type only.</p>
              </button>
            ))}
          </div>
        ) : (board.data ?? []).length === 0 && gatheringDishes.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid md:grid-cols-[0.8fr_1.2fr]">
              <div className="border-b border-border bg-secondary p-6 md:border-b-0 md:border-r">
                <span className="font-display text-8xl leading-none text-accent">--</span>
                <p className="mt-2 text-xs font-bold uppercase text-muted-foreground">
                  {selectedCat ? (lang === "th" ? selectedCat.name_th : selectedCat.name_en) : "Selected board"}
                </p>
              </div>
              <div className="p-6 md:p-8">
                <h2 className="font-display text-4xl leading-tight">{t("empty_rankings_title")}</h2>
                <p className="mt-3 max-w-lg leading-7 text-muted-foreground">{t("empty_rankings_body")}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/submit">
                    <Button>{t("cta_add")}</Button>
                  </Link>
                  <Link to="/compare">
                    <Button variant="outline">{t("cta_compare")}</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {(board.data ?? []).length > 0 && (
              <section>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {(board.data ?? []).map((d: any, i: number) => (
                    <div key={d.id}>
                      <DishCard dish={d} rank={i + 1} />
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="rounded-full border border-accent/50 bg-accent/15 px-2.5 py-1 text-xs font-semibold text-foreground">
                          {t("trusted_rank")}
                        </span>
                        <ShareButton
                          url={(typeof window !== "undefined" ? window.location.origin : "") + `/dish/${d.id}`}
                          title={d.name_en ?? d.name_th ?? "Dish"}
                          text={`${d.place?.name ?? ""}${d.price_thb != null ? ` / THB ${Number(d.price_thb).toFixed(0)}` : ""} / Currently ranked #${i + 1}`}
                          label={t("share")}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {gatheringDishes.length > 0 && (
              <section className="border-t border-border pt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">{t("gathering_progress")}</p>
                    <h2 className="mt-1 font-display text-3xl leading-tight">{t("not_ranked_yet")}</h2>
                  </div>
                  <Link to="/compare" search={{ category: cat } as any}>
                    <Button variant="outline">{t("cta_compare")}</Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {gatheringDishes.map((d: any) => <DishCard key={d.id} dish={d} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
