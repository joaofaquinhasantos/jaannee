import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listAreas, listCategories, listDishes, leaderboard } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { DishCard } from "@/components/DishCard";
import { LeaderboardEntry } from "@/components/LeaderboardEntry";
import { Button } from "@/components/ui/button";
import { DishBrowser } from "@/components/DishBrowser";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Dish rankings — JaanNee" },
      { name: "description", content: "Live rankings for Thailand's best dishes, based on head-to-head comparisons from local diners across Bangkok categories and areas." },
      { property: "og:title", content: "Dish rankings — JaanNee" },
      { property: "og:description", content: "Live rankings for Thailand's best dishes, based on head-to-head comparisons from local diners." },
      { property: "og:url", content: "https://jaannee.lovable.app/rankings" },
      { name: "twitter:title", content: "Dish rankings — JaanNee" },
      { name: "twitter:description", content: "Live rankings for Thailand's best dishes, based on head-to-head comparisons from local diners." },
    ],
    links: [{ rel: "canonical", href: "https://jaannee.lovable.app/rankings" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Dish rankings",
          description: "Live rankings for Thailand's best dishes, based on head-to-head diner comparisons.",
          url: "https://jaannee.lovable.app/rankings",
          isPartOf: { "@id": "https://jaannee.lovable.app/#website" },
        }),
      },
    ],
  }),
  component: Rankings,
});

function Rankings() {
  const { t } = useI18n();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });
  const [cat, setCat] = useState<string | undefined>();
  const [subtype, setSubtype] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();

  const selectedCat = (categories.data ?? []).find((c: any) => c.slug === cat) as any;
  const subtypes = ((selectedCat?.subtypes ?? []) as any[])
    .filter((item) => item.is_active)
    .sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name_en.localeCompare(b.name_en),
    );
  const subtypeScoped = Boolean(selectedCat?.requires_subtype) || subtypes.length > 0;
  const poolReady = Boolean(cat) && (!subtypeScoped || Boolean(subtype));

  const board = useQuery({
    queryKey: ["leaderboard", cat, subtype, area],
    queryFn: () =>
      leaderboard({ data: { categorySlug: cat!, subtypeSlug: subtype, areaSlug: area, minimumComparisons: 5 } }),
    enabled: poolReady,
  });

  const unranked = useQuery({
    queryKey: ["rankings-unranked", cat, subtype, area],
    queryFn: () => listDishes({ data: { categorySlug: cat, subtypeSlug: subtype, areaSlug: area } }),
    enabled: poolReady,
  });
  const gatheringDishes = ((unranked.data ?? []) as any[])
    .filter((dish) => (dish.comparisons_count ?? 0) < 5)
    .sort(
      (a, b) =>
        (b.tried_count ?? 0) - (a.tried_count ?? 0) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  return (
    <AppShell>
      <section className="pb-6 pt-5 md:pb-8 md:pt-10">
        <h1 className="font-display text-5xl leading-none tracking-[-0.04em] md:text-6xl">
          {t("nav_rankings")}
        </h1>
      </section>

      <DishBrowser
        categories={categories.data ?? []}
        areas={areas.data ?? []}
        category={cat}
        subtype={subtype}
        area={area}
        onCategoryChange={setCat}
        onSubtypeChange={setSubtype}
        onAreaChange={setArea}
      />

      <div className="mt-7">
        {categories.isSuccess && (categories.data ?? []).length === 0 ? (
          <EmptyBoard title="No rankings yet." />
        ) : !cat ? (
          <p className="py-10 text-sm text-muted-foreground">Choose a dish category.</p>
        ) : subtypeScoped && !subtype ? (
          <p className="py-10 text-sm text-muted-foreground">Choose a dish type.</p>
        ) : (board.data ?? []).length === 0 && gatheringDishes.length === 0 ? (
          <div className="border-t border-border py-10">
            <h2 className="font-display text-3xl">No ranking yet.</h2>
            <div className="mt-5 flex gap-5">
              <Link to="/submit" className="text-sm font-semibold text-primary">
                {t("cta_add")}
              </Link>
              <Link to="/compare" className="text-sm font-semibold text-foreground">
                {t("cta_compare")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {(board.data ?? []).length > 0 && (
              <section className="space-y-14 md:space-y-20">
                {(board.data ?? []).slice(0, 3).map((d: any, i: number) => (
                  <LeaderboardEntry key={d.id} dish={d} rank={i + 1} featured={i === 0} />
                ))}
                {(board.data ?? []).length > 3 && (
                  <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2">
                    {(board.data ?? []).slice(3).map((d: any, i: number) => (
                      <LeaderboardEntry key={d.id} dish={d} rank={i + 4} />
                    ))}
                  </div>
                )}
              </section>
            )}
            {gatheringDishes.length > 0 && (
              <section className="border-t border-border pt-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label-caps text-primary">{t("gathering_progress")}</p>
                    <h2 className="mt-2 font-display text-4xl leading-[0.9]">{t("not_ranked_yet")}</h2>
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

function EmptyBoard({ title }: { title: string }) {
  return (
    <div className="border-t border-border py-10">
      <h2 className="font-display text-3xl">{title}</h2>
      <div className="mt-5 flex gap-5">
        <Link to="/submit" className="text-sm font-semibold text-primary">
          Add a dish
        </Link>
        <Link to="/" className="text-sm font-semibold text-foreground">
          Discover
        </Link>
      </div>
    </div>
  );
}
