import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DishBrowser } from "@/components/DishBrowser";
import { listAreas, listCategories, listDishes } from "@/lib/dishes.functions";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JaanNee — Bangkok dishes, ranked by diners" },
      {
        name: "description",
        content:
          "Discover and compare individual dishes in Bangkok. Rankings are shaped exclusively by diners who have tried both dishes.",
      },
      { property: "og:title", content: "JaanNee — Bangkok dishes, ranked by diners" },
      {
        property: "og:description",
        content:
          "Discover and compare individual dishes in Bangkok. Rankings are shaped exclusively by diners who have tried both dishes.",
      },
      { property: "og:url", content: "https://jaannee.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://jaannee.lovable.app/" }],
  }),
  component: Index,
});

type CategoryRow = {
  id: string;
  slug: string;
  name_en: string;
  name_th?: string | null;
  reference_photo_url?: string | null;
  requires_subtype?: boolean | null;
  subtypes?: Array<{
    id: string;
    slug: string;
    name_en: string;
    name_th?: string | null;
    is_active?: boolean | null;
    display_order?: number | null;
  }>;
};

type DishRow = {
  id: string;
  name_en: string;
  name_th?: string | null;
  photo_url?: string | null;
  price_thb?: number | null;
  elo?: number | null;
  comparisons_count?: number | null;
  tried_count?: number | null;
  place?: {
    name?: string | null;
    area?: { name_en?: string | null; name_th?: string | null } | null;
  } | null;
};

function Index() {
  const { lang, t } = useI18n();
  const [cat, setCat] = useState<string | undefined>();
  const [subtype, setSubtype] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });
  const dishes = useQuery({
    queryKey: ["dishes", cat, subtype, area],
    queryFn: () =>
      listDishes({ data: { categorySlug: cat, subtypeSlug: subtype, areaSlug: area } }),
  });
  const categoryRows = (categories.data ?? []) as CategoryRow[];
  const selectedCategory = categoryRows.find((item) => item.slug === cat);
  const activeSubtypes = [...(selectedCategory?.subtypes ?? [])]
    .filter((item) => item.is_active)
    .sort(
      (a, b) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) || a.name_en.localeCompare(b.name_en),
    );
  const subtypeScoped = Boolean(selectedCategory?.requires_subtype) || activeSubtypes.length > 0;
  const dishRows = (dishes.data ?? []) as unknown as DishRow[];
  const photoCategories = categoryRows.filter((item) => item.reference_photo_url);
  const heroDish = dishRows.find((item) => item.photo_url);
  const heroCategory = selectedCategory?.reference_photo_url
    ? selectedCategory
    : photoCategories[0];

  return (
    <AppShell tone="noir" fullBleed>
      <div className="sticky top-[61px] z-30 border-b border-white/10 bg-[#111111]/95 px-4 py-3 backdrop-blur md:top-[65px] md:px-8">
        <div className="grid items-center gap-3 lg:grid-cols-[auto_1fr]">
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.24em] text-white/40 lg:block">
            {t("discover_bangkok")}
          </p>
          <DishBrowser
            categories={categoryRows}
            areas={areas.data ?? []}
            category={cat}
            subtype={subtype}
            area={area}
            tone="noir"
            onCategoryChange={setCat}
            onSubtypeChange={setSubtype}
            onAreaChange={setArea}
          />
        </div>
      </div>

      {cat && subtypeScoped && !subtype ? (
        <section className="flex min-h-[70vh] items-center justify-center px-6 text-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
              {t("dish_type")}
            </p>
            <h1 className="mt-4 font-noir-display text-5xl uppercase text-white md:text-7xl">
              {t("choose_dish_type")}
            </h1>
          </div>
        </section>
      ) : dishes.isLoading ? (
        <div className="min-h-[70vh] px-6 py-16 text-sm text-white/45">{t("loading")}</div>
      ) : heroDish ? (
        <DishFeed dishes={dishRows} singlePool={Boolean(cat)} />
      ) : heroCategory ? (
        <CategoryFeed
          categories={
            selectedCategory?.reference_photo_url
              ? [
                  selectedCategory,
                  ...photoCategories.filter((item) => item.id !== selectedCategory.id),
                ]
              : photoCategories
          }
          lang={lang}
          onSelect={(slug) => {
            setCat(slug);
            setSubtype(undefined);
          }}
        />
      ) : (
        <EmptyNoir />
      )}

      <Link
        to="/submit"
        aria-label={t("cta_add")}
        className="fixed bottom-24 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-2xl md:bottom-7 md:right-7"
      >
        <Plus className="h-5 w-5" />
      </Link>
    </AppShell>
  );
}

function CategoryFeed({
  categories,
  lang,
  onSelect,
}: {
  categories: CategoryRow[];
  lang: string;
  onSelect: (slug: string) => void;
}) {
  const { t } = useI18n();
  const [first, ...rest] = categories;
  if (!first) return <EmptyNoir />;
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(first.slug)}
        className="group relative block min-h-[72vh] w-full overflow-hidden text-left md:min-h-[820px]"
      >
        <NoirPhoto src={first.reference_photo_url ?? ""} />
        <div className="absolute inset-x-0 bottom-0 z-10 max-w-4xl p-6 md:p-12 lg:p-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
            {t("featured_category")}
          </p>
          <h1 className="mt-3 font-noir-display text-6xl uppercase leading-[0.82] text-white md:text-8xl lg:text-[8.5rem]">
            {lang === "th" ? first.name_th || first.name_en : first.name_en}
          </h1>
          {first.name_th && lang !== "th" ? (
            <p className="mt-3 font-thai text-base text-white/65">{first.name_th}</p>
          ) : null}
          <span className="mt-7 inline-flex items-center gap-2 border border-white/30 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors group-hover:border-primary group-hover:bg-primary">
            {t("explore_category")} <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>
      {rest.length > 0 ? (
        <div className="grid md:grid-cols-2">
          {rest.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.slug)}
              className="group relative min-h-[520px] overflow-hidden border-t border-white/10 text-left md:min-h-[680px] md:border-r"
            >
              <NoirPhoto src={category.reference_photo_url ?? ""} />
              <div className="absolute inset-x-0 bottom-0 z-10 p-6 md:p-10">
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-primary">
                  {t("browse_board")}
                </p>
                <h2 className="mt-2 font-noir-display text-5xl uppercase leading-[0.86] text-white md:text-7xl">
                  {lang === "th" ? category.name_th || category.name_en : category.name_en}
                </h2>
                <ArrowUpRight className="mt-5 h-5 w-5 text-white/65 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </button>
          ))}
        </div>
      ) : null}
      <div className="border-t border-white/10 px-6 py-16 text-center md:py-24">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
          {t("tagline")}
        </p>
        <Link
          to="/submit"
          className="mt-5 inline-block border-b border-primary pb-1 text-xs font-bold uppercase tracking-[0.18em] text-white"
        >
          {t("add_first_dish")}
        </Link>
      </div>
    </div>
  );
}

function DishFeed({ dishes, singlePool }: { dishes: DishRow[]; singlePool: boolean }) {
  const { lang, t } = useI18n();
  const withPhotos = dishes.filter((dish) => dish.photo_url);
  const withoutPhotos = dishes.filter((dish) => !dish.photo_url);
  return (
    <div>
      <div className="grid md:grid-cols-2">
        {withPhotos.map((dish, index) => (
          <NoirDish
            key={dish.id}
            dish={dish}
            featured={index === 0}
            rank={
              singlePool && (dish.comparisons_count ?? 0) >= PUBLIC_RANK_THRESHOLD
                ? dishes.indexOf(dish) + 1
                : undefined
            }
          />
        ))}
      </div>
      {withoutPhotos.length > 0 ? (
        <div className="grid border-t border-white/10 md:grid-cols-2 lg:grid-cols-3">
          {withoutPhotos.map((dish) => (
            <Link
              key={dish.id}
              to="/dish/$id"
              params={{ id: dish.id }}
              className="border-b border-r border-white/10 p-7 transition-colors hover:bg-white/[0.04]"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
                {t("photo_needed")}
              </p>
              <h2 className="mt-3 font-noir-display text-4xl uppercase text-white">
                {lang === "th" && dish.name_th ? dish.name_th : dish.name_en}
              </h2>
              <p className="mt-3 text-xs text-white/45">{dish.place?.name}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NoirDish({ dish, rank, featured }: { dish: DishRow; rank?: number; featured?: boolean }) {
  const { lang, t } = useI18n();
  const ranked = (dish.comparisons_count ?? 0) >= PUBLIC_RANK_THRESHOLD;
  const dishName = lang === "th" && dish.name_th ? dish.name_th : dish.name_en;
  const areaName = dish.place?.area
    ? lang === "th"
      ? dish.place.area.name_th || dish.place.area.name_en
      : dish.place.area.name_en
    : null;
  return (
    <Link
      to="/dish/$id"
      params={{ id: dish.id }}
      className={`group relative overflow-hidden border-b border-r border-white/10 ${featured ? "min-h-[76vh] md:col-span-2 md:min-h-[820px]" : "min-h-[560px] md:min-h-[700px]"}`}
    >
      <NoirPhoto src={dish.photo_url ?? ""} />
      <div className="absolute inset-x-0 bottom-0 z-10 p-6 md:p-10">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-primary">
              {ranked
                ? `${dish.comparisons_count} ${t("diner_comparisons")}`
                : `${t("unranked_label")} · ${dish.comparisons_count ?? 0}/${PUBLIC_RANK_THRESHOLD}`}
            </p>
            <h2
              className={`mt-2 font-noir-display uppercase leading-[0.84] text-white ${featured ? "text-6xl md:text-8xl lg:text-[8rem]" : "text-5xl md:text-7xl"}`}
            >
              {dishName}
            </h2>
            <p className="mt-4 text-xs text-white/55">
              {[dish.place?.name, areaName].filter(Boolean).join(" · ")}
            </p>
          </div>
          {rank ? (
            <span className="font-noir-display text-6xl text-white/80 md:text-8xl">
              #{String(rank).padStart(2, "0")}
            </span>
          ) : (
            <ArrowUpRight className="mb-1 h-5 w-5 shrink-0 text-white/60 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          )}
        </div>
      </div>
    </Link>
  );
}

function NoirPhoto({ src }: { src: string }) {
  return (
    <>
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover saturate-[0.85] transition-transform duration-700 group-hover:scale-[1.025]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/10" />
      <div className="absolute inset-0 bg-black/10 mix-blend-multiply" />
    </>
  );
}

function EmptyNoir() {
  const { t } = useI18n();
  return (
    <section className="flex min-h-[74vh] items-end bg-[#111111] px-6 py-16 md:px-12 md:py-24">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
          {t("bangkok_dish_board")}
        </p>
        <h1 className="mt-4 max-w-4xl font-noir-display text-6xl uppercase leading-[0.84] text-white md:text-8xl">
          {t("what_should_bangkok_eat")}
        </h1>
        <Link
          to="/submit"
          className="mt-8 inline-flex items-center gap-2 border border-white/25 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white hover:border-primary hover:bg-primary"
        >
          {t("add_first_dish")} <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
