import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DishBrowser } from "@/components/DishBrowser";
import { TriedActivation } from "@/components/TriedActivation";
import { getDiscoverBootstrap, listDishes } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { localizedName, secondaryName } from "@/lib/names";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";
import { hasActiveDiscoverFilters, shouldShowCategoryGallery } from "@/lib/discover-state";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(discoverBootstrapQuery),
  head: () => ({
    meta: [
      { title: "JaanNee — Bangkok dishes, ranked by diners" },
      {
        name: "description",
        content:
          "Discover individual Bangkok dishes. Rankings come only from diners who tried both dishes in the same dish type.",
      },
      { property: "og:title", content: "JaanNee — Rank the dish, not the restaurant" },
      {
        property: "og:description",
        content: "Discover Bangkok dishes and help settle genuine diner-powered rankings.",
      },
      { property: "og:url", content: "https://jaannee.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://jaannee.lovable.app/" }],
  }),
  component: Index,
});

const discoverBootstrapQuery = queryOptions({
  queryKey: ["discover-bootstrap"],
  queryFn: () => getDiscoverBootstrap(),
  staleTime: 5 * 60_000,
});

type SubtypeRow = {
  id: string;
  slug: string;
  name_en: string;
  name_th?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
};

type CategoryRow = {
  id: string;
  slug: string;
  name_en: string;
  name_th?: string | null;
  reference_photo_url?: string | null;
  requires_subtype?: boolean | null;
  subtypes?: SubtypeRow[];
};

type AreaRow = {
  id?: string;
  slug?: string;
  name_en?: string | null;
  name_th?: string | null;
};

type DishRow = {
  id: string;
  name_en?: string | null;
  name_th?: string | null;
  photo_url?: string | null;
  price_thb?: number | null;
  comparisons_count?: number | null;
  tried_count?: number | null;
  created_at?: string | null;
  category?: CategoryRow | null;
  subtype?: SubtypeRow | null;
  place?: { name?: string | null; area?: AreaRow | null } | null;
};

function Index() {
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const [categorySlug, setCategorySlug] = useState<string | undefined>();
  const [subtypeSlug, setSubtypeSlug] = useState<string | undefined>();
  const [areaSlug, setAreaSlug] = useState<string | undefined>();

  const bootstrap = useQuery(discoverBootstrapQuery);
  const categoryRows = (bootstrap.data?.categories ?? []) as CategoryRow[];
  const areaRows = (bootstrap.data?.areas ?? []) as AreaRow[];
  const selectedCategory = categoryRows.find((item) => item.slug === categorySlug);
  const selectedArea = areaRows.find((item) => item.slug === areaSlug);
  const activeSubtypes = useMemo(
    () =>
      [...(selectedCategory?.subtypes ?? [])]
        .filter((item) => item.is_active === true)
        .sort(
          (a, b) =>
            Number(a.display_order ?? 0) - Number(b.display_order ?? 0) ||
            a.name_en.localeCompare(b.name_en),
        ),
    [selectedCategory],
  );
  const subtypeScoped = Boolean(selectedCategory?.requires_subtype) || activeSubtypes.length > 0;
  const poolReady = Boolean(categorySlug) && (!subtypeScoped || Boolean(subtypeSlug));

  useEffect(() => {
    if (!categorySlug || subtypeSlug || activeSubtypes.length !== 1) return;
    setSubtypeSlug(activeSubtypes[0].slug);
  }, [activeSubtypes, categorySlug, subtypeSlug]);

  const hasFilters = Boolean(categorySlug || areaSlug);
  const filteredDishes = useQuery({
    queryKey: ["dishes", categorySlug, subtypeSlug, areaSlug],
    queryFn: () =>
      listDishes({
        data: {
          categorySlug,
          subtypeSlug,
          areaSlug,
        },
      }),
    enabled: hasFilters && (!categorySlug || !subtypeScoped || Boolean(subtypeSlug)),
  });

  const dishRows = (hasFilters ? filteredDishes.data : bootstrap.data?.dishes ?? []) as DishRow[];
  const ranked = poolReady
    ? dishRows.filter((dish) => Number(dish.comparisons_count ?? 0) >= PUBLIC_RANK_THRESHOLD)
    : [];
  const contenders = dishRows
    .filter((dish) => Number(dish.comparisons_count ?? 0) < PUBLIC_RANK_THRESHOLD)
    .sort(
      (a, b) =>
        Number(b.comparisons_count ?? 0) - Number(a.comparisons_count ?? 0) ||
        Number(b.tried_count ?? 0) - Number(a.tried_count ?? 0) ||
        dateValue(b.created_at) - dateValue(a.created_at) ||
        a.id.localeCompare(b.id),
    );
  const recent = [...dishRows]
    .sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at) || a.id.localeCompare(b.id))
    .slice(0, 8);
  const leader = ranked.find((dish) => dish.photo_url) ?? contenders.find((dish) => dish.photo_url);
  const categoryPhotos = categoryRows.filter((category) => category.reference_photo_url);
  const discoverFilters = { categorySlug, areaSlug };

  const changeCategory = (slug: string | undefined) => {
    setCategorySlug(slug);
    setSubtypeSlug(undefined);
  };

  return (
    <AppShell tone="noir" fullBleed>
      <div className="sticky top-[61px] z-30 border-b border-white/10 bg-[#111111]/95 px-4 py-3 backdrop-blur md:top-[65px] md:px-8">
        <div className="grid items-center gap-3 lg:grid-cols-[auto_1fr]">
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.24em] text-white/40 lg:block">
            {t("discover_bangkok")}
          </p>
          <DishBrowser
            categories={categoryRows}
            areas={areaRows}
            category={categorySlug}
            subtype={subtypeSlug}
            area={areaSlug}
            tone="noir"
            onCategoryChange={changeCategory}
            onSubtypeChange={setSubtypeSlug}
            onAreaChange={setAreaSlug}
          />
        </div>
      </div>

      <TriedActivation dishes={dishRows} />

      {categorySlug && subtypeScoped && !subtypeSlug && activeSubtypes.length > 1 ? (
        <SubtypeChooser
          category={selectedCategory!}
          subtypes={activeSubtypes}
          onSelect={setSubtypeSlug}
          onChangeCategory={() => changeCategory(undefined)}
        />
      ) : bootstrap.isLoading ||
        filteredDishes.isLoading ||
        (categorySlug && subtypeScoped && activeSubtypes.length === 1 && !subtypeSlug) ? (
        <div className="min-h-[40vh] px-6 py-16 text-sm text-white/45">{t("loading")}</div>
      ) : leader ? (
        <div>
          <HeroDish
            dish={leader}
            rank={ranked.findIndex((dish) => dish.id === leader.id) + 1}
            poolReady={poolReady}
          />

          {ranked.length > 1 ? (
            <DishSection
              eyebrow={t("section_top_ranked")}
              title={copy("Current leaders", "ผู้นำอันดับ")}
              description={t("section_top_ranked_body")}
              dishes={ranked.filter((dish) => dish.id !== leader.id).slice(0, 6)}
              ranked
            />
          ) : null}

          {contenders.length > 0 ? (
            <DishSection
              eyebrow={t("section_almost_ranked")}
              title={copy("New contenders", "ผู้ท้าชิงใหม่")}
              description={t("section_almost_ranked_body")}
              dishes={contenders.filter((dish) => dish.id !== leader.id).slice(0, 6)}
            />
          ) : null}

          {recent.some(
            (dish) =>
              dish.id !== leader.id && !contenders.slice(0, 6).some((item) => item.id === dish.id),
          ) ? (
            <DishSection
              eyebrow={t("section_recent")}
              title={copy("Recently approved", "จานที่เพิ่งอนุมัติ")}
              description={t("section_recent_body")}
              dishes={recent
                .filter(
                  (dish) =>
                    dish.id !== leader.id &&
                    !ranked.slice(1, 7).some((item) => item.id === dish.id) &&
                    !contenders.slice(0, 6).some((item) => item.id === dish.id),
                )
                .slice(0, 6)}
            />
          ) : null}
        </div>
      ) : shouldShowCategoryGallery(discoverFilters, categoryPhotos.length) ? (
        <CategoryGallery categories={categoryPhotos.slice(0, 8)} onSelect={changeCategory} />
      ) : hasActiveDiscoverFilters(discoverFilters) ? (
        <FilteredEmptyDiscover
          category={selectedCategory}
          area={selectedArea}
          onReset={() => {
            changeCategory(undefined);
            setAreaSlug(undefined);
          }}
        />
      ) : (
        <EmptyDiscover />
      )}

      <Link
        to="/submit"
        aria-label={t("nav_submit")}
        className="fixed bottom-24 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:bottom-7 md:right-7"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </Link>
    </AppShell>
  );
}

function SubtypeChooser({
  category,
  subtypes,
  onSelect,
  onChangeCategory,
}: {
  category: CategoryRow;
  subtypes: SubtypeRow[];
  onSelect: (slug: string) => void;
  onChangeCategory: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <section className="bg-[#111111] px-5 py-10 text-white md:px-8 md:py-16">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={onChangeCategory}
          className="min-h-11 border-b border-primary text-xs font-bold uppercase tracking-[0.16em] text-white"
        >
          {t("change_category")}
        </button>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
          {localizedName(category, lang)}
        </p>
        <h1 className="mt-3 font-noir-display text-5xl uppercase leading-[0.86] md:text-7xl">
          {t("choose_dish_type")}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
          {t("choose_dish_type_body")}
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subtypes.map((subtype) => (
            <button
              key={subtype.id}
              type="button"
              onClick={() => onSelect(subtype.slug)}
              className="group min-h-28 border border-white/15 p-5 text-left transition hover:border-primary hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="font-noir-display text-3xl uppercase leading-none">
                {localizedName(subtype, lang)}
              </span>
              {secondaryName(subtype, lang) ? (
                <span className="mt-2 block font-thai text-sm text-white/55 group-hover:text-white/80">
                  {secondaryName(subtype, lang)}
                </span>
              ) : null}
              <ArrowUpRight className="mt-5 h-4 w-4 text-white/50 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-white" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroDish({ dish, rank, poolReady }: { dish: DishRow; rank: number; poolReady: boolean }) {
  const { t, lang } = useI18n();
  const ranked =
    poolReady && rank > 0 && Number(dish.comparisons_count ?? 0) >= PUBLIC_RANK_THRESHOLD;
  const name = localizedName(dish, lang);
  const alternate = secondaryName(dish, lang);
  const area = localizedName(dish.place?.area, lang);
  return (
    <Link
      to="/dish/$id"
      params={{ id: dish.id }}
      className="group relative block min-h-[62vh] overflow-hidden bg-black md:min-h-[760px]"
    >
      <NoirPhoto src={dish.photo_url ?? ""} alt={name} priority />
      <div className="absolute inset-x-0 bottom-0 z-10 max-w-5xl p-6 md:p-12 lg:p-16">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
          {ranked
            ? `${t("trusted_rank")} · #${rank}`
            : `${t("unranked_label")} · ${Number(dish.comparisons_count ?? 0)}/${PUBLIC_RANK_THRESHOLD}`}
        </p>
        <h1 className="mt-3 font-noir-display text-6xl uppercase leading-[0.82] text-white md:text-8xl lg:text-[8rem]">
          {name}
        </h1>
        {alternate ? <p className="mt-3 font-thai text-lg text-white/65">{alternate}</p> : null}
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-white/60">
          {[dish.place?.name, area].filter(Boolean).join(" · ")}
        </p>
        <span className="mt-7 inline-flex min-h-11 items-center gap-2 border border-white/30 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition group-hover:border-primary group-hover:bg-primary">
          {lang === "th" ? "ดูจานนี้" : "View dish"}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function DishSection({
  eyebrow,
  title,
  description,
  dishes,
  ranked = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  dishes: DishRow[];
  ranked?: boolean;
}) {
  if (dishes.length === 0) return null;
  return (
    <section className="border-t border-white/10 bg-[#111111] px-5 py-12 text-white md:px-8 md:py-16">
      <div className="mx-auto max-w-[112rem]">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-noir-display text-5xl uppercase leading-[0.86] md:text-6xl">
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">{description}</p>
        <div className="mt-8 grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {dishes.map((dish, index) => (
            <CompactDish key={dish.id} dish={dish} rank={ranked ? index + 2 : undefined} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CompactDish({ dish, rank }: { dish: DishRow; rank?: number }) {
  const { t, lang } = useI18n();
  const name = localizedName(dish, lang);
  return (
    <Link
      to="/dish/$id"
      params={{ id: dish.id }}
      className="group relative min-h-[390px] overflow-hidden bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
    >
      {dish.photo_url ? (
        <NoirPhoto src={dish.photo_url} alt={name} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] text-sm text-white/35">
          {t("photo_needed")}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 z-10 p-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">
          {rank
            ? `#${rank} · ${dish.comparisons_count ?? 0} ${t("comparisons_progress")}`
            : `${t("gathering_progress")} · ${dish.comparisons_count ?? 0}/${PUBLIC_RANK_THRESHOLD}`}
        </p>
        <h3 className="mt-2 font-noir-display text-4xl uppercase leading-[0.86] text-white">
          {name}
        </h3>
        <p className="mt-3 text-xs text-white/50">{dish.place?.name}</p>
      </div>
    </Link>
  );
}

function CategoryGallery({
  categories,
  onSelect,
}: {
  categories: CategoryRow[];
  onSelect: (slug: string) => void;
}) {
  const { t, lang } = useI18n();
  return (
    <section className="bg-[#111111] text-white">
      <div className="grid sm:grid-cols-2">
        {categories.map((category, index) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.slug)}
            className={`group relative overflow-hidden border-b border-white/10 text-left ${
              index === 0
                ? "min-h-[62vh] sm:col-span-2 md:min-h-[720px]"
                : "min-h-[440px] md:min-h-[580px]"
            }`}
          >
            <NoirPhoto src={category.reference_photo_url ?? ""} alt="" priority={index === 0} />
            <div className="absolute inset-x-0 bottom-0 z-10 p-6 md:p-10">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-primary">
                {t("explore_category")}
              </p>
              <h2 className="mt-2 font-noir-display text-5xl uppercase leading-[0.86] md:text-7xl">
                {localizedName(category, lang)}
              </h2>
              <ArrowUpRight className="mt-5 h-5 w-5 text-white/65 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function NoirPhoto({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <>
      <img
        src={src}
        alt={alt}
        width={1400}
        height={1000}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className="absolute inset-0 h-full w-full object-cover saturate-[0.85] transition-transform duration-700 group-hover:scale-[1.025]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/10" />
      <div className="absolute inset-0 bg-black/10 mix-blend-multiply" />
    </>
  );
}

function FilteredEmptyDiscover({
  category,
  area,
  onReset,
}: {
  category?: CategoryRow;
  area?: AreaRow;
  onReset: () => void;
}) {
  const { t, lang } = useI18n();
  const filterName = [localizedName(category, lang), localizedName(area, lang)]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="flex min-h-[56vh] items-end bg-[#111111] px-6 py-16 text-white md:px-12 md:py-20">
      <div className="max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
          {filterName || t("discover_bangkok")}
        </p>
        <h1 className="mt-4 font-noir-display text-5xl uppercase leading-[0.86] md:text-7xl">
          {t("no_dishes_for_filters")}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">
          {t("no_dishes_for_filters_body")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center border border-white/25 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white hover:border-primary hover:bg-primary"
          >
            {t("reset_filters")}
          </button>
          <Link
            to="/submit"
            className="inline-flex min-h-11 items-center gap-2 bg-primary px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white hover:bg-primary/90"
          >
            {t("cta_add")}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function EmptyDiscover() {
  const { t, lang } = useI18n();
  return (
    <section className="flex min-h-[56vh] items-end bg-[#111111] px-6 py-16 md:px-12 md:py-20">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
          {t("tagline")}
        </p>
        <h1 className="mt-4 max-w-4xl font-noir-display text-6xl uppercase leading-[0.84] text-white md:text-8xl">
          {lang === "th" ? "กรุงเทพฯ ควรกินจานไหน" : "What should Bangkok eat?"}
        </h1>
        <Link
          to="/submit"
          className="mt-8 inline-flex min-h-11 items-center gap-2 border border-white/25 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white hover:border-primary hover:bg-primary"
        >
          {t("add_the_first_dish")}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function dateValue(value?: string | null): number {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}
