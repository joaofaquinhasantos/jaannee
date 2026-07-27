import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DishCard } from "@/components/DishCard";
import { listDishes, listCategories, listAreas, listActivityFeed, listFollowingActivityFeed } from "@/lib/dishes.functions";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DishBrowser } from "@/components/DishBrowser";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JaanNee — Rank Thailand's best dishes, plate by plate" },
      { name: "description", content: "Add plates and compare dishes head-to-head to find the best Pad Kra Pao, Khao Soi, Boat Noodles and more in Bangkok." },
      { property: "og:title", content: "JaanNee — Rank Thailand's best dishes, plate by plate" },
      { property: "og:description", content: "Add plates and compare dishes head-to-head to find the best Pad Kra Pao, Khao Soi, Boat Noodles and more in Bangkok." },
      { property: "og:url", content: "https://jaannee.lovable.app/" },
      { name: "twitter:title", content: "JaanNee — Rank Thailand's best dishes, plate by plate" },
      { name: "twitter:description", content: "Add plates and compare dishes head-to-head to find the best Pad Kra Pao, Khao Soi, Boat Noodles and more in Bangkok." },
    ],
    links: [{ rel: "canonical", href: "https://jaannee.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useI18n();
  const [cat, setCat] = useState<string | undefined>();
  const [subtype, setSubtype] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();
  const [authed, setAuthed] = useState(false);
  const [followingOnly, setFollowingOnly] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  const dishes = useQuery({
    queryKey: ["dishes", cat, subtype, area],
    queryFn: () =>
      listDishes({ data: { categorySlug: cat, subtypeSlug: subtype, areaSlug: area } }),
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const selectedCategory = (categories.data ?? []).find((c: any) => c.slug === cat);
  const activeSubtypes = [...((selectedCategory as any)?.subtypes ?? [])]
    .filter((s: any) => s.is_active)
    .sort(
      (a: any, b: any) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        a.name_en.localeCompare(b.name_en),
    );
  const subtypeScoped =
    Boolean((selectedCategory as any)?.requires_subtype) || activeSubtypes.length > 0;
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });
  const activity = useQuery({
    queryKey: ["activity-feed", followingOnly],
    queryFn: () => followingOnly ? listFollowingActivityFeed() : listActivityFeed({ data: {} }),
    enabled: !followingOnly || authed,
  });
  return (
    <AppShell>
      <section className="hidden md:block">
        <div className="max-w-5xl py-12 lg:py-16">
          <p className="label-caps text-primary">Bangkok dish board</p>
          <h1 className="mt-5 max-w-4xl font-display text-[4.6rem] leading-[0.9] tracking-[-0.04em] text-foreground lg:text-[5.2rem]">
            What should people eat in Bangkok?
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">Dish by dish, diner by diner.</p>
          <p className="mt-2 font-thai text-base text-foreground/70">
            จานไหนดี ให้คนกินช่วยตัดสิน
          </p>
          <div className="mt-8 flex items-center gap-6">
            <Link to="/compare">
              <Button className="ink-button">{t("cta_compare")}</Button>
            </Link>
            <Link
              to="/submit"
              className="text-sm font-semibold text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:text-primary"
            >
              {t("cta_add")}
            </Link>
          </div>
        </div>
      </section>

      <section className="md:hidden">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-primary">Bangkok dish board</p>
            <p className="mt-1 font-display text-3xl leading-none">What should we eat?</p>
          </div>
          <Link to="/submit">
            <Button size="sm">Post</Button>
          </Link>
        </div>
      </section>

      <section className="mt-6 border-t border-foreground/20 pt-6 md:mt-2 md:pt-7">
        <p className="mb-4 label-caps text-muted-foreground">Browse dishes</p>
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

        {selectedCategory?.reference_photo_url && (
          <div className="relative mt-6 h-52 overflow-hidden bg-muted md:h-72">
            <img
              src={selectedCategory.reference_photo_url}
              alt={lang === "th" ? selectedCategory.name_th : selectedCategory.name_en}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex max-w-[75%] flex-col justify-end p-4 text-white md:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                Category reference
              </p>
              <h2 className="mt-1 font-display text-3xl leading-none md:text-5xl">
                {lang === "th" ? selectedCategory.name_th : selectedCategory.name_en}
              </h2>
              {lang === "th" && selectedCategory.name_en ? (
                <p className="mt-1 text-sm text-white/80">{selectedCategory.name_en}</p>
              ) : selectedCategory.name_th ? (
                <p className="mt-1 font-thai text-sm text-white/80">{selectedCategory.name_th}</p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6">
        {cat && subtypeScoped && !subtype ? (
          <p className="py-8 text-sm text-muted-foreground">Choose a dish type.</p>
        ) : dishes.isLoading ? (
          <p className="text-muted-foreground">{t("loading")}</p>
        ) : (dishes.data ?? []).length === 0 ? (
          <EditorialEmpty
            title="No dishes yet."
            body="Add the first one."
            primary={t("cta_add")}
            secondary={t("filter_all_categories")}
            onSecondary={() => {
              setCat(undefined);
              setSubtype(undefined);
              setArea(undefined);
            }}
          />
        ) : (
          (() => {
            const rows = dishes.data ?? [];
            const ranked = rows.filter((d) => (d.comparisons_count ?? 0) >= PUBLIC_RANK_THRESHOLD);
            const contenders = rows.filter((d) => (d.comparisons_count ?? 0) < PUBLIC_RANK_THRESHOLD);
            // Numeric ranks are only meaningful within one valid ranking
            // pool. listDishes returns [] for a subtype-scoped category
            // without a subtype, so when a category filter is set here
            // the results are already one pool. Without a category filter
            // the discovery view can mix pools, so we omit numeric ranks.
            const singlePool = Boolean(cat);
            return (
              <div className="space-y-10">
                {ranked.length > 0 && (
                  <section>
                    <div className="mb-4">
                      <h2 className="font-display text-3xl leading-tight">{t("ranked_dishes")}</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {ranked.map((d: any, i: number) => (
                        <DishCard key={d.id} dish={d} rank={singlePool ? i + 1 : undefined} />
                      ))}
                    </div>
                  </section>
                )}
                {contenders.length > 0 && (
                  <section className={ranked.length > 0 ? "border-t border-border pt-6" : undefined}>
                    <div className="mb-4">
                      {ranked.length === 0 ? (
                        <>
                          <h2 className="font-display text-3xl leading-tight">{t("no_ranked_yet_title")}</h2>
                        </>
                      ) : (
                        <>
                          <h2 className="font-display text-3xl leading-tight">{t("new_contenders")}</h2>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {contenders.map((d: any) => (
                        <DishCard key={d.id} dish={d} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            );
          })()
        )}
      </section>
      {(activity.data ?? []).length > 0 && (
        <section className="mt-8 md:mt-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl leading-none">Taste feed</h2>
            {authed ? (
              <div className="flex rounded-full border border-border bg-card p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFollowingOnly(false)}
                  className={`rounded-full px-3 py-1 ${!followingOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFollowingOnly(true)}
                  className={`rounded-full px-3 py-1 ${followingOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Following
                </button>
              </div>
            ) : (
              <span className="text-xs font-bold uppercase text-muted-foreground">People eating now</span>
            )}
          </div>
          <div className="space-y-2">
            {(activity.data ?? []).slice(0, 6).map((item: any, i: number) => (
              <Link
                key={`${item.type}-${item.dish?.id}-${item.created_at}-${i}`}
                to="/dish/$id"
                params={{ id: item.dish.id }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-lg text-muted-foreground">
                  {(item.profile?.display_name || item.profile?.username || "J").slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {item.profile?.display_name || item.profile?.username || "Someone"}{" "}
                    <span className="font-normal text-muted-foreground">
                      {item.type === "tried" ? "tried" : "posted"}
                    </span>{" "}
                    {item.dish?.name_en}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.dish?.place?.name}{item.body ? ` / "${item.body}"` : ""}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <Link
        to="/submit"
        className="fixed bottom-28 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl font-semibold leading-none text-primary-foreground shadow-[0_16px_35px_rgba(218,43,31,0.3)] md:hidden"
        aria-label="Add a dish"
      >
        +
      </Link>
    </AppShell>
  );
}
function EditorialEmpty({
  title,
  body,
  primary,
  secondary,
  onSecondary,
}: {
  title: string;
  body: string;
  primary: string;
  secondary: string;
  onSecondary: () => void;
}) {
  return (
    <div className="border-t border-border py-10">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">{body}</p>
      <div className="mt-5 flex items-center gap-5">
        <Link to="/submit" className="text-sm font-semibold text-primary">
          {primary}
        </Link>
        <button
          type="button"
          onClick={onSecondary}
          className="text-sm font-semibold text-foreground"
        >
          {secondary}
        </button>
      </div>
    </div>
  );
}
