import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DishBrowser } from "@/components/DishBrowser";
import { DishCard } from "@/components/DishCard";
import { HowRankingWorks } from "@/components/HowRankingWorks";
import { LeaderboardEntry } from "@/components/LeaderboardEntry";
import { listAreas, listCategories, listDishes, leaderboard } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Dish rankings — JaanNee" },
      {
        name: "description",
        content:
          "Bangkok dish rankings based exclusively on same-type comparisons from diners who tried both dishes.",
      },
      { property: "og:title", content: "Dish rankings — JaanNee" },
      {
        property: "og:description",
        content: "Rank the dish, not the restaurant. Public ranks require five diner comparisons.",
      },
      { property: "og:url", content: "https://jaannee.lovable.app/rankings" },
    ],
    links: [{ rel: "canonical", href: "https://jaannee.lovable.app/rankings" }],
  }),
  component: Rankings,
});

function Rankings() {
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });
  const [cat, setCat] = useState<string | undefined>();
  const [subtype, setSubtype] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();

  const selectedCat = (categories.data ?? []).find((category: any) => category.slug === cat) as any;
  const subtypes = ((selectedCat?.subtypes ?? []) as any[])
    .filter((item) => item.is_active)
    .sort(
      (a, b) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        String(a.name_en).localeCompare(String(b.name_en)),
    );
  const subtypeScoped = Boolean(selectedCat?.requires_subtype) || subtypes.length > 0;
  const poolReady = Boolean(cat) && (!subtypeScoped || Boolean(subtype));

  const board = useQuery({
    queryKey: ["leaderboard", cat, subtype, area],
    queryFn: () =>
      leaderboard({
        data: {
          categorySlug: cat!,
          subtypeSlug: subtype,
          areaSlug: area,
          minimumComparisons: PUBLIC_RANK_THRESHOLD,
        },
      }),
    enabled: poolReady,
  });

  const unranked = useQuery({
    queryKey: ["rankings-unranked", cat, subtype, area],
    queryFn: () =>
      listDishes({ data: { categorySlug: cat, subtypeSlug: subtype, areaSlug: area } }),
    enabled: poolReady,
  });
  const gatheringDishes = ((unranked.data ?? []) as any[])
    .filter((dish) => Number(dish.comparisons_count ?? 0) < PUBLIC_RANK_THRESHOLD)
    .sort(
      (a, b) =>
        Number(b.comparisons_count ?? 0) - Number(a.comparisons_count ?? 0) ||
        Number(b.tried_count ?? 0) - Number(a.tried_count ?? 0) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
        String(a.id).localeCompare(String(b.id)),
    )
    .slice(0, 12);

  return (
    <AppShell>
      <section className="border-b border-border pb-6 pt-5 md:pb-8 md:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="editorial-kicker text-primary">
              {copy("Diner-powered leaderboard", "อันดับจากนักชิม")}
            </p>
            <h1 className="type-page-title mt-3">{t("nav_rankings")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("rankings_intro")}
            </p>
          </div>
          <HowRankingWorks variant="outline" />
        </div>
      </section>

      <div className="mt-5">
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
      </div>

      <div className="mt-7">
        {categories.isSuccess && (categories.data ?? []).length === 0 ? (
          <EmptyBoard title={copy("No rankings yet.", "ยังไม่มีอันดับ")} />
        ) : !cat ? (
          <p className="py-10 text-sm text-muted-foreground">
            {copy("Choose a dish category.", "เลือกหมวดจาน")}
          </p>
        ) : subtypeScoped && !subtype ? (
          <p className="py-10 text-sm text-muted-foreground">
            {copy("Choose a dish type.", "เลือกประเภทจาน")}
          </p>
        ) : (board.data ?? []).length === 0 && gatheringDishes.length === 0 ? (
          <EmptyBoard title={copy("No ranking yet.", "ยังไม่มีอันดับ")} />
        ) : (
          <div className="space-y-12">
            {(board.data ?? []).length > 0 ? (
              <section>
                <div className="mb-6">
                  <p className="label-caps text-primary">{t("section_top_ranked")}</p>
                  <h2 className="type-section-title mt-2">
                    {copy("Ranked dishes", "จานที่มีอันดับ")}
                  </h2>
                </div>
                <div className="space-y-14 md:space-y-20">
                  {(board.data ?? []).slice(0, 3).map((dish: any, index: number) => (
                    <LeaderboardEntry
                      key={dish.id}
                      dish={dish}
                      rank={index + 1}
                      featured={index === 0}
                    />
                  ))}
                  {(board.data ?? []).length > 3 ? (
                    <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2">
                      {(board.data ?? []).slice(3).map((dish: any, index: number) => (
                        <LeaderboardEntry key={dish.id} dish={dish} rank={index + 4} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {gatheringDishes.length > 0 ? (
              <section className="border-t border-border pt-7">
                <div className="mb-5">
                  <p className="label-caps text-primary">{t("gathering_progress")}</p>
                  <h2 className="type-section-title mt-2">
                    {copy("New contenders", "ผู้ท้าชิงใหม่")}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    {t("section_almost_ranked_body")}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {gatheringDishes.map((dish: any) => (
                    <DishCard key={dish.id} dish={dish} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyBoard({ title }: { title: string }) {
  const { t, lang } = useI18n();
  return (
    <div className="border-t border-border py-10">
      <h2 className="type-section-title">{title}</h2>
      <div className="mt-5 flex gap-5">
        <Link to="/submit" className="text-sm font-semibold text-primary">
          {t("cta_add")}
        </Link>
        <Link to="/" className="text-sm font-semibold text-foreground">
          {lang === "th" ? "ค้นพบจาน" : "Discover dishes"}
        </Link>
      </div>
    </div>
  );
}
