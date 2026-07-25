import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  listCategories,
  listCurrentUserTriedDishes,
  submitComparison,
} from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CategoryPicker } from "@/components/CategoryPicker";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare two dishes — JaanNee" },
      { name: "description", content: "Pick two Thai dishes in the same category and choose the winner. Every vote shapes the JaanNee leaderboard for that plate." },
      { property: "og:title", content: "Compare two dishes — JaanNee" },
      { property: "og:description", content: "Pick two Thai dishes in the same category and vote the winner. Every vote shapes the leaderboard." },
      { property: "og:url", content: "https://jaannee.lovable.app/compare" },
      { name: "twitter:title", content: "Compare two dishes — JaanNee" },
      { name: "twitter:description", content: "Pick two Thai dishes in the same category and vote the winner. Every vote shapes the leaderboard." },
    ],
    links: [{ rel: "canonical", href: "https://jaannee.lovable.app/compare" }],
  }),
  validateSearch: (s: Record<string, unknown>): { dish?: string; category?: string } => {
    const out: { dish?: string; category?: string } = {};
    if (typeof s.dish === "string") out.dish = s.dish;
    if (typeof s.category === "string") out.category = s.category;
    return out;
  },
  component: Compare,
});

function Compare() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [authState, setAuthState] = useState<"loading" | "in" | "out">("loading");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthState(data.user ? "in" : "out"));
  }, []);

  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
    enabled: authState === "in",
  });
  const triedQ = useQuery({
    queryKey: ["tried", "current-user", "compare"],
    queryFn: () => listCurrentUserTriedDishes(),
    enabled: authState === "in",
  });

  const triedDishes = (triedQ.data ?? []) as any[];
  const categoriesById = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of (categoriesQ.data ?? []) as any[]) map.set(c.id, c);
    return map;
  }, [categoriesQ.data]);

  // Categories the user actually has tried dishes in, hydrated from
  // listCategories so the picker can group by cuisine.
  const eligibleCategories = useMemo(() => {
    const byId = new Map<string, any>();
    for (const d of triedDishes) {
      if (!d.category?.id || byId.has(d.category.id)) continue;
      byId.set(d.category.id, categoriesById.get(d.category.id) ?? d.category);
    }
    return [...byId.values()];
  }, [triedDishes, categoriesById]);

  const [cat, setCat] = useState<string | undefined>(undefined);
  const [subtype, setSubtype] = useState<string | undefined>(undefined);
  const [aId, setAId] = useState<string | undefined>(undefined);
  const [bId, setBId] = useState<string | undefined>(undefined);
  const [preselectIgnored, setPreselectIgnored] = useState(false);

  const selectedCat = eligibleCategories.find((c: any) => c.slug === cat);
  const triedInCat = useMemo(
    () => triedDishes.filter((d) => d.category?.slug === cat),
    [triedDishes, cat],
  );
  // Subtype-scoped when the category flag is set, or when any tried dish
  // in this category carries a subtype (approval trigger guarantees that
  // approved dishes in scoped categories always have a subtype).
  const scoped =
    !!selectedCat?.requires_subtype || triedInCat.some((d) => !!d.subtype_id);
  const eligibleSubtypes = useMemo(() => {
    const byId = new Map<string, any>();
    for (const d of triedInCat) {
      if (!d.subtype?.id || byId.has(d.subtype.id)) continue;
      byId.set(d.subtype.id, d.subtype);
    }
    return [...byId.values()].sort(
      (a: any, b: any) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        a.name_en.localeCompare(b.name_en),
    );
  }, [triedInCat]);

  const list = useMemo(() => {
    if (!cat) return [] as any[];
    if (scoped && !subtype) return [];
    return triedInCat.filter((d) =>
      scoped ? d.subtype?.slug === subtype : !d.subtype_id,
    );
  }, [cat, subtype, scoped, triedInCat]);

  // Auto-select first eligible category (respecting ?category=).
  useEffect(() => {
    if (cat || eligibleCategories.length === 0) return;
    const pre = search.category
      ? eligibleCategories.find((c: any) => c.slug === search.category)
      : undefined;
    setCat((pre ?? eligibleCategories[0]).slug);
  }, [eligibleCategories, cat, search.category]);

  // Preselect ?dish=... only if the user has tried it. If ineligible, note it.
  useEffect(() => {
    if (!search.dish || authState !== "in" || !triedQ.isSuccess) return;
    const match = triedDishes.find((d) => d.id === search.dish);
    if (!match) {
      setPreselectIgnored(true);
      return;
    }
    setCat(match.category?.slug);
    if (match.subtype?.slug) setSubtype(match.subtype.slug);
    setAId(match.id);
    // Only run once when tried data is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triedQ.isSuccess]);

  const a = useMemo(() => list.find((d) => d.id === aId), [list, aId]);
  const b = useMemo(() => list.find((d) => d.id === bId), [list, bId]);

  const mut = useMutation({
    mutationFn: async (winnerId: string) => {
      if (!a || !b) throw new Error("Choose both dishes");
      if (a.id === b.id) throw new Error("Choose two different dishes");
      if (a.category?.id !== b.category?.id)
        throw new Error("Dishes must be in the same category");
      if (scoped && a.subtype?.id !== b.subtype?.id)
        throw new Error("Dishes must be the same dish type");
      return submitComparison({ data: { dishAId: a.id, dishBId: b.id, winnerId } });
    },
    onSuccess: (res: any) => {
      if (res?.ok === false) return;
      toast.success(t("comparison_saved"));
      setAId(undefined);
      setBId(undefined);
      qc.invalidateQueries({ queryKey: ["tried"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (authState === "loading") {
    return (
      <AppShell>
        <div className="mt-10 text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  if (authState === "out") {
    return (
      <AppShell>
        <section className="mt-10 max-w-lg rounded-lg border border-border bg-card p-6">
          <h1 className="font-display text-4xl leading-none">Sign in to compare dishes</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Comparisons are based on dishes you have personally tried. Sign in to continue.
          </p>
          <Link to="/auth" search={{ redirect: "/compare" }}>
            <Button className="mt-5">{t("sign_in")}</Button>
          </Link>
        </section>
      </AppShell>
    );
  }

  const loadingTried = triedQ.isLoading || categoriesQ.isLoading;
  const triedError = triedQ.error as Error | null;

  return (
    <AppShell>
      <section className="border-b border-border pb-4 md:pb-7">
        <p className="text-xs font-bold uppercase text-primary">Head to head</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl leading-none md:text-7xl">{t("nav_compare")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:mt-3 md:text-base md:leading-7">
              Compare only dishes you have personally tried, within the same category and dish type.
            </p>
          </div>
        </div>
      </section>

      {preselectIgnored && (
        <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          That dish must be marked as tried before it can be compared.
        </div>
      )}

      {loadingTried ? (
        <div className="mt-6 text-sm text-muted-foreground">Loading your tried dishes…</div>
      ) : triedError ? (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <h2 className="font-display text-3xl">We couldn't load your tried dishes.</h2>
          <p className="mt-2 text-sm text-muted-foreground">{triedError.message}</p>
          <Button className="mt-4" variant="outline" onClick={() => triedQ.refetch()}>
            Try again
          </Button>
        </div>
      ) : eligibleCategories.length === 0 ? (
        <EmptyCta
          title="No tried dishes yet"
          description="Mark dishes as tried before comparing them."
          ctaLabel="Discover dishes"
          to="/"
        />
      ) : (
        <>
          <div className="mt-6 max-w-sm">
            <CategoryPicker
              categories={eligibleCategories}
              value={cat}
              lang={lang}
              placeholder={t("choose_category")}
              onChange={(_, category) => {
                setCat(category.slug);
                setSubtype(undefined);
                setAId(undefined);
                setBId(undefined);
              }}
            />
          </div>
          {scoped && eligibleSubtypes.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {eligibleSubtypes.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSubtype(s.slug);
                    setAId(undefined);
                    setBId(undefined);
                  }}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${subtype === s.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                >
                  {lang === "th" ? s.name_th : s.name_en}
                </button>
              ))}
            </div>
          )}

          {cat && scoped && !subtype ? (
            <div className="mt-6 rounded-lg border border-border bg-card p-6">
              <h2 className="font-display text-3xl">Choose a dish type first</h2>
              <p className="mt-2 text-muted-foreground">
                Comparisons only happen between the same actual dish type.
              </p>
            </div>
          ) : cat && list.length < 2 ? (
            <EmptyCta
              title="You need two tried dishes"
              description="Mark at least two dishes as tried in this category and dish type before comparing them."
              ctaLabel="Discover more dishes"
              to="/"
            />
          ) : cat ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <DishPicker
                label="Dish A"
                value={aId}
                onChange={setAId}
                options={list.filter((d) => d.id !== bId)}
                lang={lang}
              />
              <DishPicker
                label="Dish B"
                value={bId}
                onChange={setBId}
                options={list.filter((d) => d.id !== aId)}
                lang={lang}
              />
            </div>
          ) : null}
        </>
      )}

      {a && b && (
        <div className="mt-8">
          <p className="text-center text-sm font-semibold uppercase text-muted-foreground">{t("which_better")}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <WinnerCard dish={a} onPick={() => mut.mutate(a.id)} disabled={mut.isPending} />
            <WinnerCard dish={b} onPick={() => mut.mutate(b.id)} disabled={mut.isPending} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

function EmptyCta({
  title,
  description,
  ctaLabel,
  to,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  to: string;
}) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mt-2 max-w-lg text-muted-foreground">{description}</p>
      <Link to={to}>
        <Button className="mt-5">{ctaLabel}</Button>
      </Link>
    </div>
  );
}

function DishPicker({
  label,
  value,
  onChange,
  options,
  lang,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  options: any[];
  lang: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("pick_dish")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {(lang === "th" && d.name_th) || d.name_en} - {d.place?.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function WinnerCard({
  dish,
  onPick,
  disabled,
}: {
  dish: any;
  onPick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className="group overflow-hidden rounded-lg border border-border bg-card text-left shadow-[0_18px_45px_rgba(42,30,36,0.06)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_22px_60px_rgba(42,30,36,0.1)] disabled:opacity-60"
    >
      <div className="aspect-[4/3] bg-muted">
        {dish.photo_url ? (
          <img src={dish.photo_url} alt={dish.name_en} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary font-display text-4xl italic text-muted-foreground">JaanNee</div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-2xl leading-none">{dish.name_en}</h3>
        {dish.name_th ? <p className="mt-1 font-thai text-sm font-medium text-muted-foreground">{dish.name_th}</p> : null}
        <p className="mt-2 text-sm text-muted-foreground">{dish.place?.name}</p>
      </div>
    </button>
  );
}
