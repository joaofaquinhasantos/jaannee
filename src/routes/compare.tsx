import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

type CompareSearch = {
  dish?: string;
  other?: string;
  category?: string;
};

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare two dishes — JaanNee" },
      {
        name: "description",
        content:
          "Pick two dishes you have tried in the same ranking pool and choose the one you prefer.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): CompareSearch => {
    const out: CompareSearch = {};
    if (typeof search.dish === "string") out.dish = search.dish;
    if (typeof search.other === "string") out.other = search.other;
    if (typeof search.category === "string") out.category = search.category;
    return out;
  },
  beforeLoad: ({ search }) => {
    if (!search.dish && !search.category) throw redirect({ to: "/" });
  },
  component: Compare,
});

function Compare() {
  const { t, lang } = useI18n();
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
    for (const category of (categoriesQ.data ?? []) as any[]) map.set(category.id, category);
    return map;
  }, [categoriesQ.data]);

  const eligibleCategories = useMemo(() => {
    const byId = new Map<string, any>();
    for (const dish of triedDishes) {
      if (!dish.category?.id || byId.has(dish.category.id)) continue;
      byId.set(dish.category.id, categoriesById.get(dish.category.id) ?? dish.category);
    }
    return [...byId.values()];
  }, [triedDishes, categoriesById]);

  const [cat, setCat] = useState<string | undefined>();
  const [subtype, setSubtype] = useState<string | undefined>();
  const [aId, setAId] = useState<string | undefined>();
  const [bId, setBId] = useState<string | undefined>();
  const [preselectIgnored, setPreselectIgnored] = useState(false);

  const selectedCat = eligibleCategories.find((category: any) => category.slug === cat);
  const triedInCat = useMemo(
    () => triedDishes.filter((dish) => dish.category?.slug === cat),
    [triedDishes, cat],
  );
  const activeCategorySubtypes = useMemo(() => {
    const subtypes = ((selectedCat?.subtypes ?? []) as any[]).filter(
      (item) => item.is_active === true,
    );
    return subtypes.sort(
      (a: any, b: any) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        String(a.name_en).localeCompare(String(b.name_en)),
    );
  }, [selectedCat]);
  const scoped = Boolean(selectedCat?.requires_subtype) || activeCategorySubtypes.length > 0;

  const eligibleSubtypes = useMemo(() => {
    const activeById = new Map<string, any>();
    for (const item of activeCategorySubtypes) activeById.set(item.id, item);
    const byId = new Map<string, any>();
    for (const dish of triedInCat) {
      const subtypeId = dish.subtype?.id;
      if (!subtypeId || byId.has(subtypeId)) continue;
      const active = activeById.get(subtypeId);
      if (active) byId.set(subtypeId, active);
    }
    return [...byId.values()].sort(
      (a: any, b: any) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        String(a.name_en).localeCompare(String(b.name_en)),
    );
  }, [triedInCat, activeCategorySubtypes]);

  const list = useMemo(() => {
    if (!cat || (scoped && !subtype)) return [] as any[];
    if (scoped) {
      const activeSlugs = new Set(activeCategorySubtypes.map((item: any) => item.slug));
      return triedInCat.filter(
        (dish) => dish.subtype?.slug === subtype && activeSlugs.has(dish.subtype?.slug),
      );
    }
    return triedInCat.filter((dish) => !dish.subtype_id);
  }, [cat, subtype, scoped, triedInCat, activeCategorySubtypes]);

  useEffect(() => {
    if (cat || eligibleCategories.length === 0) return;
    const requested = search.category
      ? eligibleCategories.find((category: any) => category.slug === search.category)
      : undefined;
    setCat((requested ?? eligibleCategories[0]).slug);
  }, [eligibleCategories, cat, search.category]);

  useEffect(() => {
    if (!search.dish || authState !== "in" || !triedQ.isSuccess) return;
    const first = triedDishes.find((dish) => dish.id === search.dish);
    if (!first) {
      setPreselectIgnored(true);
      return;
    }

    setCat(first.category?.slug);
    setSubtype(first.subtype?.slug);
    setAId(first.id);

    if (!search.other) return;
    const second = triedDishes.find((dish) => dish.id === search.other);
    const sameCategory = second?.category?.id === first.category?.id;
    const sameSubtype = (second?.subtype?.id ?? null) === (first.subtype?.id ?? null);
    if (second && sameCategory && sameSubtype) setBId(second.id);
    else setPreselectIgnored(true);
  }, [authState, search.dish, search.other, triedDishes, triedQ.isSuccess]);

  const a = useMemo(() => list.find((dish) => dish.id === aId), [list, aId]);
  const b = useMemo(() => list.find((dish) => dish.id === bId), [list, bId]);

  const mut = useMutation({
    mutationFn: async (winnerId: string) => {
      if (!a || !b)
        throw new Error(lang === "th" ? "เลือกจานทั้งสองจาน" : "Choose both dishes");
      if (a.id === b.id)
        throw new Error(
          lang === "th" ? "เลือกจานที่แตกต่างกันสองจาน" : "Choose two different dishes",
        );
      if (a.category?.id !== b.category?.id)
        throw new Error(
          lang === "th" ? "จานต้องอยู่ในหมวดเดียวกัน" : "Dishes must be in the same category",
        );
      if (scoped && a.subtype?.id !== b.subtype?.id)
        throw new Error(
          lang === "th" ? "จานต้องเป็นประเภทเดียวกัน" : "Dishes must be the same dish type",
        );
      return submitComparison({ data: { dishAId: a.id, dishBId: b.id, winnerId } });
    },
    onSuccess: (result: any) => {
      if (result?.ok === false) return;
      toast.success(t("comparison_saved"));
      setAId(undefined);
      setBId(undefined);
      qc.invalidateQueries({ queryKey: ["tried"] });
      qc.invalidateQueries({ queryKey: ["dishes"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["dish"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: any) => toast.error(error.message),
  });

  const returnParams = new URLSearchParams();
  if (search.dish) returnParams.set("dish", search.dish);
  if (search.other) returnParams.set("other", search.other);
  if (search.category) returnParams.set("category", search.category);
  const returnTo = `/compare?${returnParams.toString()}`;

  if (authState === "loading") {
    return (
      <AppShell>
        <div className="mt-10 text-sm text-muted-foreground">{t("loading")}</div>
      </AppShell>
    );
  }

  if (authState === "out") {
    return (
      <AppShell>
        <section className="mt-10 max-w-lg rounded-lg border border-border bg-card p-6">
          <h1 className="type-page-title">{t("sign_in_to_compare")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("sign_in_compare_body")}</p>
          <Link to="/auth" search={{ redirect: returnTo }}>
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
      <section className="editorial-rule pb-5 pt-4 md:pb-7">
        <p className="editorial-kicker text-primary">{t("head_to_head")}</p>
        <h1 className="type-page-title mt-3">{t("nav_compare")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:mt-3 md:text-base md:leading-7">
          {t("compare_page_intro")}
        </p>
      </section>

      {preselectIgnored && (
        <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          {t("preselect_not_tried")}
        </div>
      )}

      {loadingTried ? (
        <div className="mt-6 text-sm text-muted-foreground">{t("loading_tried")}</div>
      ) : triedError ? (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <h2 className="type-section-title">{t("tried_load_error")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{triedError.message}</p>
          <Button className="mt-4" variant="outline" onClick={() => triedQ.refetch()}>
            {t("try_again")}
          </Button>
        </div>
      ) : eligibleCategories.length === 0 ? (
        <EmptyCta
          title={t("no_tried_yet")}
          description={t("mark_tried_before_compare")}
          ctaLabel={t("discover_dishes")}
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
              {eligibleSubtypes.map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSubtype(item.slug);
                    setAId(undefined);
                    setBId(undefined);
                  }}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${subtype === item.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                >
                  {lang === "th" ? item.name_th || item.name_en : item.name_en}
                </button>
              ))}
            </div>
          )}

          {cat && scoped && !subtype ? (
            <div className="mt-6 rounded-lg border border-border bg-card p-6">
              <h2 className="type-section-title">{t("choose_dish_type_first")}</h2>
              <p className="mt-2 text-muted-foreground">{t("same_dish_type_only")}</p>
            </div>
          ) : cat && list.length < 2 ? (
            <EmptyCta
              title={t("need_two_tried")}
              description={t("need_two_tried_body")}
              ctaLabel={t("discover_more_dishes")}
              to="/"
            />
          ) : cat ? (
            <div className="mt-6 grid gap-0 border-2 border-foreground md:grid-cols-2">
              <DishPicker
                label={t("dish_a")}
                value={aId}
                onChange={setAId}
                options={list.filter((dish) => dish.id !== bId)}
                lang={lang}
              />
              <DishPicker
                label={t("dish_b")}
                value={bId}
                onChange={setBId}
                options={list.filter((dish) => dish.id !== aId)}
                lang={lang}
              />
            </div>
          ) : null}
        </>
      )}

      {a && b && (
        <div className="mt-10">
          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-foreground/35" />
            <p className="label-caps text-center text-primary">{t("which_better")}</p>
            <span className="h-px flex-1 bg-foreground/35" />
          </div>
          <div className="relative mt-5 grid overflow-hidden border-2 border-foreground bg-ink md:grid-cols-2">
            <PickCard dish={a} onPick={() => mut.mutate(a.id)} disabled={mut.isPending} />
            <PickCard dish={b} onPick={() => mut.mutate(b.id)} disabled={mut.isPending} />
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-paper bg-primary font-display text-3xl italic text-white shadow-xl">
              VS
            </div>
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
      <h2 className="type-section-title">{title}</h2>
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
  onChange: (value: string) => void;
  options: any[];
  lang: string;
}) {
  const { t } = useI18n();
  return (
    <div className="border-b-2 border-foreground bg-card p-4 last:border-b-0 md:border-b-0 md:border-r-2 md:last:border-r-0">
      <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("pick_dish")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((dish) => (
            <SelectItem key={dish.id} value={dish.id}>
              {(lang === "th" && dish.name_th) || dish.name_en} - {dish.place?.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PickCard({
  dish,
  onPick,
  disabled,
}: {
  dish: any;
  onPick: () => void;
  disabled?: boolean;
}) {
  const { lang, t } = useI18n();
  const primaryName = lang === "th" && dish.name_th ? dish.name_th : dish.name_en;
  const secondaryName = lang === "th" && dish.name_th ? dish.name_en : dish.name_th;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className="group relative min-h-[24rem] overflow-hidden bg-ink text-left transition-[filter,transform] hover:z-10 hover:scale-[1.01] hover:brightness-110 disabled:opacity-60 md:min-h-[34rem]"
    >
      <div className="absolute inset-0 bg-muted">
        {dish.photo_url ? (
          <img src={dish.photo_url} alt={primaryName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary font-display text-4xl italic text-muted-foreground">
            {t("brand")}
          </div>
        )}
      </div>
      <div className="photo-scrim absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8">
        <p className="label-caps mb-3 text-white/65">{t("choose_this_dish")}</p>
        <h3 className="type-card-title">{primaryName}</h3>
        {secondaryName ? (
          <p className="mt-2 font-thai text-base font-medium text-white/80">{secondaryName}</p>
        ) : null}
        <p className="mt-3 border-t border-white/35 pt-3 text-sm font-bold uppercase tracking-[0.08em] text-white/80">
          {dish.place?.name}
        </p>
      </div>
    </button>
  );
}
