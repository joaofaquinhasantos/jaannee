import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DishCard } from "@/components/DishCard";
import { listDishes, listCategories, listAreas, listCategoryCounts, listActivityFeed, listFollowingActivityFeed } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/CategoryPicker";
import { AreaPicker } from "@/components/AreaPicker";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JaanNee — Rank Thailand's best dishes, plate by plate" },
      { name: "description", content: "Add plates, vote dish against dish, and find the best Pad Kra Pao, Khao Soi, Boat Noodles and more across Bangkok restaurants and stalls." },
      { property: "og:title", content: "JaanNee — Rank Thailand's best dishes, plate by plate" },
      { property: "og:description", content: "Add plates, vote dish against dish, and find the best Pad Kra Pao, Khao Soi, Boat Noodles and more across Bangkok restaurants and stalls." },
      { property: "og:url", content: "https://jaannee.lovable.app/" },
      { name: "twitter:title", content: "JaanNee — Rank Thailand's best dishes, plate by plate" },
      { name: "twitter:description", content: "Add plates, vote dish against dish, and find the best Pad Kra Pao, Khao Soi, Boat Noodles and more across Bangkok restaurants and stalls." },
    ],
    links: [{ rel: "canonical", href: "https://jaannee.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useI18n();
  const [cat, setCat] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();
  const [authed, setAuthed] = useState(false);
  const [followingOnly, setFollowingOnly] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  const dishes = useQuery({
    queryKey: ["dishes", cat, area],
    queryFn: () => listDishes({ data: { categorySlug: cat, areaSlug: area } }),
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const categoryCounts = useQuery({ queryKey: ["category-counts"], queryFn: () => listCategoryCounts() });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });
  const allDishes = useQuery({ queryKey: ["dishes", "area-counts"], queryFn: () => listDishes({ data: {} }) });
  const activity = useQuery({
    queryKey: ["activity-feed", followingOnly],
    queryFn: () => followingOnly ? listFollowingActivityFeed() : listActivityFeed({ data: {} }),
    enabled: !followingOnly || authed,
  });
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

  return (
    <AppShell>
      <section className="hidden border-b border-border pb-6 md:grid md:grid-cols-[1.1fr_0.9fr] md:gap-10 md:pb-12">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Bangkok dish board</p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl leading-[0.95] text-foreground md:text-7xl">
            What should people eat in Bangkok?
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
            Add plates, vote dish against dish, and find the bite worth crossing town for.
          </p>
          <p className="mt-3 font-thai text-lg font-medium text-foreground/80">
            จานไหนดี ให้คนกินช่วยตัดสิน
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/compare">
              <Button>{t("cta_compare")}</Button>
            </Link>
            <Link to="/submit">
              <Button variant="outline">{t("cta_add")}</Button>
            </Link>
          </div>
          <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <TrustSignal text="No restaurant ads" />
            <TrustSignal text="Dish vs dish only" />
            <TrustSignal text="Ranked by local comparisons" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 md:mt-0 md:gap-3">
          {["01", "02", "03"].map((n, i) => (
            <div key={n} className={`rounded-lg border border-border bg-card p-3 md:p-4 ${i === 1 ? "md:mt-8" : ""}`}>
              <span className="font-display text-4xl leading-none text-accent md:text-5xl">{n}</span>
              <p className="mt-2 text-xs font-bold uppercase text-muted-foreground md:mt-3">
                {i === 0 ? "Nominate" : i === 1 ? "Compare" : "Rank"}
              </p>
            </div>
          ))}
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

      <section className="mt-4 md:mt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="hidden text-xs font-bold uppercase text-muted-foreground md:block">Browse the board</p>
            <h2 className="hidden font-display text-3xl md:mt-1 md:block">Discover</h2>
            <p className="hidden text-sm text-muted-foreground md:mt-1 md:block">
              Start here: pick a category, add a missing dish, or compare two plates.
            </p>
          </div>
          {(cat || area) && (
            <button
              onClick={() => {
                setCat(undefined);
                setArea(undefined);
              }}
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 md:mt-5">
          <Pill active={!cat} onClick={() => setCat(undefined)}>
            {t("filter_all_categories")}
          </Pill>
          {topCategories.map((c: any) => (
            <Pill key={c.id} active={cat === c.slug} onClick={() => setCat(c.slug)}>
              {lang === "th" ? c.name_th : c.name_en}
            </Pill>
          ))}
          <div className="min-w-48">
            <CategoryPicker
              categories={categories.data ?? []}
              value={cat}
              lang={lang}
              placeholder={t("filter_all_categories")}
              triggerLabel={cat ? t("change_category") : t("more_categories")}
              onChange={(_, category) => setCat(category.slug)}
            />
          </div>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          <Pill active={!area} onClick={() => setArea(undefined)} variant="secondary">
            {t("filter_all_areas")}
          </Pill>
          {topAreas.map((a: any) => (
            <Pill key={a.id} active={area === a.slug} onClick={() => setArea(a.slug)} variant="secondary">
              {lang === "th" ? a.name_th : a.name_en}
            </Pill>
          ))}
          <div className="min-w-36">
            <AreaPicker areas={areas.data ?? []} value={area} lang={lang} onChange={(slug) => setArea(slug)} />
          </div>
        </div>
      </section>

      <section className="mt-6">
        {dishes.isLoading ? (
          <p className="text-muted-foreground">{t("loading")}</p>
        ) : (dishes.data ?? []).length === 0 ? (
          <EditorialEmpty
            title="The board is hungry."
            body="No dishes match this view yet. Add the first plate, then let comparisons sort out the legend from the tourist trap."
            primary={t("cta_add")}
            secondary={t("filter_all_categories")}
            onSecondary={() => {
              setCat(undefined);
              setArea(undefined);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(dishes.data ?? []).map((d: any) => (
              <DishCard key={d.id} dish={d} />
            ))}
          </div>
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
                      {item.type === "tried" ? "ate" : "posted"}
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

function TrustSignal({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 font-semibold">
      {text}
    </div>
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
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid md:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-border bg-secondary p-6 md:border-b-0 md:border-r">
          <span className="font-display text-7xl leading-none text-accent">00</span>
          <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">No verdict yet</p>
        </div>
        <div className="p-6 md:p-8">
          <h2 className="font-display text-4xl leading-tight">{title}</h2>
          <p className="mt-3 max-w-lg leading-7 text-muted-foreground">{body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/submit">
              <Button>{primary}</Button>
            </Link>
            <Button variant="outline" onClick={onSecondary}>{secondary}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  variant = "primary",
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const base = "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors";
  const on =
    variant === "primary"
      ? "border-primary bg-primary text-primary-foreground"
      : "border-accent bg-accent text-accent-foreground";
  const off = "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground";
  return (
    <button onClick={onClick} className={`${base} ${active ? on : off}`}>
      {children}
    </button>
  );
}
