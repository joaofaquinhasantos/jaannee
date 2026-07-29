import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DishBrowser } from "@/components/DishBrowser";
import { DishCard } from "@/components/DishCard";
import { HowRankingWorks } from "@/components/HowRankingWorks";
import { LeaderboardEntry } from "@/components/LeaderboardEntry";
import { StitchState } from "@/components/StitchState";
import {
  getPublicTaxonomy,
  listCategoryCounts,
  listDishes,
  leaderboard,
} from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

export const Route = createFileRoute("/rankings")({
  loader: () => getPublicTaxonomy(),
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

const publicTaxonomyQuery = queryOptions({
  queryKey: ["public-taxonomy"],
  queryFn: () => getPublicTaxonomy(),
  staleTime: 10 * 60_000,
});

const categoryCountsQuery = queryOptions({
  queryKey: ["category-counts"],
  queryFn: () => listCategoryCounts(),
  staleTime: 5 * 60_000,
});

function Rankings() {
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const loadedTaxonomy = Route.useLoaderData();
  const taxonomy = useQuery({
    ...publicTaxonomyQuery,
    initialData: loadedTaxonomy,
  });
  const categories = taxonomy.data?.categories ?? [];
  const areas = taxonomy.data?.areas ?? [];
  const categoryCounts = useQuery(categoryCountsQuery);
  const orderedCategories = [...categories].sort((a, b) => {
    const counts = categoryCounts.data ?? {};
    return (
      Number(counts[b.id] ?? 0) - Number(counts[a.id] ?? 0) ||
      localizedName(a, lang).localeCompare(localizedName(b, lang))
    );
  });
  const [cat, setCat] = useState<string | undefined>();
  const [subtype, setSubtype] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();

  const selectedCat = categories.find((category: any) => category.slug === cat) as any;
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
    <AppShell tone="noir">
      <section className="stitch-masthead">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="stitch-kicker">{copy("Diner-powered leaderboard", "อันดับจากนักชิม")}</p>
            <h1 className="mt-3">{t("nav_rankings")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("rankings_intro")}
            </p>
          </div>
          <HowRankingWorks variant="outline" />
        </div>
      </section>

      <div className="sticky top-16 z-20 -mx-4 border-b border-white/10 bg-[#131313]/95 px-4 py-3 backdrop-blur-xl md:mx-0 md:px-0">
        <DishBrowser
          categories={categories}
          areas={areas}
          category={cat}
          subtype={subtype}
          area={area}
          tone="noir"
          onCategoryChange={setCat}
          onSubtypeChange={setSubtype}
          onAreaChange={setArea}
        />
      </div>

      <div className="stitch-section">
        {taxonomy.isSuccess && categories.length === 0 ? (
          <EmptyBoard title={copy("No rankings yet.", "ยังไม่มีอันดับ")} />
        ) : !cat ? (
          <section className="py-4">
            <p className="label-caps text-primary">
              {copy("Choose a ranking", "เลือกอันดับที่สนใจ")}
            </p>
            <h2 className="type-section-title mt-2">
              {copy("Browse dish categories", "เลือกหมวดจาน")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {copy(
                "Every category has its own fair comparison pool.",
                "แต่ละหมวดมีการเปรียบเทียบและอันดับแยกจากกันอย่างยุติธรรม",
              )}
            </p>
            <div className="stitch-card-grid mt-8">
              {orderedCategories.slice(0, 18).map((category) => {
                const count = Number(categoryCounts.data?.[category.id] ?? 0);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setCat(category.slug);
                      setSubtype(undefined);
                    }}
                    className={`min-h-28 border-0 bg-[#1c1b1b] px-5 py-4 text-left transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      count > 0 ? "border-border" : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    <span className="block font-semibold">{localizedName(category, lang)}</span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      {count > 0
                        ? lang === "th"
                          ? `${count} จาน`
                          : `${count} ${count === 1 ? "dish" : "dishes"}`
                        : lang === "th"
                          ? "ยังไม่มีจาน"
                          : "No dishes yet"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : subtypeScoped && !subtype ? (
          <p className="py-10 text-sm text-muted-foreground">
            {copy("Choose a dish type.", "เลือกประเภทจาน")}
          </p>
        ) : (board.data ?? []).length === 0 && gatheringDishes.length === 0 ? (
          <EmptyBoard title={copy("No ranking yet.", "ยังไม่มีอันดับ")} />
        ) : (
          <div className="space-y-20">
            {(board.data ?? []).length > 0 ? (
              <section>
                <div className="stitch-section-head">
                  <div>
                    <p className="stitch-kicker">{t("section_top_ranked")}</p>
                    <h2 className="mt-2 font-display text-5xl">
                      {copy("Ranked dishes", "จานที่มีอันดับ")}
                    </h2>
                  </div>
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
              <section className="stitch-section">
                <div className="stitch-section-head">
                  <div>
                    <p className="stitch-kicker">{t("gathering_progress")}</p>
                    <h2 className="mt-2 font-display text-5xl">
                      {copy("New contenders", "ผู้ท้าชิงใหม่")}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      {t("section_almost_ranked_body")}
                    </p>
                  </div>
                </div>
                <div className="stitch-card-grid">
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
    <StitchState
      kind="empty"
      eyebrow={t("gathering_progress")}
      title={title}
      body={
        lang === "th"
          ? "จานในกลุ่มนี้ยังต้องการการเปรียบเทียบจากนักชิมก่อนจะมีอันดับสาธารณะ"
          : "Dishes in this pool still need diner comparisons before a public ranking appears."
      }
      action={
        <>
          <Link to="/submit" className="text-sm font-semibold text-primary">
            {t("cta_add")}
          </Link>
          <Link to="/" className="text-sm font-semibold text-foreground">
            {lang === "th" ? "ค้นพบจาน" : "Discover dishes"}
          </Link>
        </>
      }
    />
  );
}
