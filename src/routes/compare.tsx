import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ComparePairChoice,
  ComparisonResultPanel,
  type TriedDish,
  useComparePairs,
} from "@/components/ContextualCompare";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare two tried dishes — JaanNee" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content: "Choose between two dishes you personally tried in the same ranking pool.",
      },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { dish?: string; other?: string; category?: string } => {
    const output: { dish?: string; other?: string; category?: string } = {};
    if (typeof search.dish === "string") output.dish = search.dish;
    if (typeof search.other === "string") output.other = search.other;
    if (typeof search.category === "string") output.category = search.category;
    return output;
  },
  beforeLoad: ({ search }) => {
    if (!search.dish && !search.category) throw redirect({ to: "/" });
  },
  component: Compare,
});

function Compare() {
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const search = Route.useSearch();
  const { authStatus, dishes, partnersFor, isLoading } = useComparePairs();
  const [aId, setAId] = useState<string | undefined>();
  const [bId, setBId] = useState<string | undefined>();
  const [result, setResult] = useState<{ winner: TriedDish; loser: TriedDish } | null>(null);

  const returnPath = useMemo(() => {
    const params = new URLSearchParams();
    if (search.dish) params.set("dish", search.dish);
    if (search.other) params.set("other", search.other);
    if (search.category) params.set("category", search.category);
    return `/compare?${params.toString()}`;
  }, [search.category, search.dish, search.other]);

  const eligibleFirstDishes = useMemo(
    () =>
      dishes.filter((dish) => {
        if (search.category && dish.category?.slug !== search.category) return false;
        return partnersFor(dish.id).length > 0;
      }),
    [dishes, partnersFor, search.category],
  );

  useEffect(() => {
    if (aId || eligibleFirstDishes.length === 0) return;
    const requested = search.dish
      ? eligibleFirstDishes.find((dish) => dish.id === search.dish)
      : undefined;
    setAId((requested ?? eligibleFirstDishes[0]).id);
  }, [aId, eligibleFirstDishes, search.dish]);

  const a = dishes.find((dish) => dish.id === aId) ?? null;
  const partnerOptions = a ? partnersFor(a.id) : [];

  useEffect(() => {
    if (!a || bId) return;
    const requested = search.other
      ? partnerOptions.find((dish) => dish.id === search.other)
      : undefined;
    setBId((requested ?? partnerOptions[0])?.id);
  }, [a, bId, partnerOptions, search.other]);

  useEffect(() => {
    if (bId && !partnerOptions.some((dish) => dish.id === bId)) setBId(undefined);
  }, [bId, partnerOptions]);

  const b = partnerOptions.find((dish) => dish.id === bId) ?? null;
  const requestedDishUnavailable =
    Boolean(search.dish) && !isLoading && !dishes.some((dish) => dish.id === search.dish);

  if (authStatus === "loading") {
    return (
      <AppShell>
        <p className="py-10 text-sm text-muted-foreground">{t("loading")}</p>
      </AppShell>
    );
  }

  if (authStatus === "out") {
    return (
      <AppShell>
        <section className="mt-10 max-w-lg rounded-lg border border-border bg-card p-6">
          <h1 className="type-page-title">{t("sign_in_to_compare")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("sign_in_compare_body")}</p>
          <Link to="/auth" search={{ redirect: returnPath }}>
            <Button className="mt-5 min-h-11">{t("sign_in")}</Button>
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="border-b border-border pb-5 pt-4 md:pb-7">
        <p className="editorial-kicker text-primary">{t("head_to_head")}</p>
        <h1 className="type-page-title mt-3">{t("nav_compare")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("compare_page_intro")}
        </p>
      </section>

      {requestedDishUnavailable ? (
        <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          {t("preselect_not_tried")}
        </div>
      ) : null}

      {isLoading ? (
        <p className="py-10 text-sm text-muted-foreground">{t("loading_tried")}</p>
      ) : result ? (
        <div className="mt-7 space-y-4">
          <ComparisonResultPanel winner={result.winner} loser={result.loser} />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setResult(null);
              setAId(undefined);
              setBId(undefined);
            }}
          >
            {copy("Compare another eligible pair", "เปรียบเทียบคู่อื่นที่พร้อม")}
          </Button>
        </div>
      ) : eligibleFirstDishes.length === 0 ? (
        <section className="mt-7 rounded-lg border border-border bg-card p-6">
          <h2 className="type-section-title">{t("no_pairs_yet")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("no_pairs_yet_body")}</p>
          <Link to="/">
            <Button className="mt-5 min-h-11">{t("discover_dishes")}</Button>
          </Link>
        </section>
      ) : (
        <div className="mt-7">
          <div className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold">
              <span>{t("dish_a")}</span>
              <Select
                value={aId}
                onValueChange={(value) => {
                  setAId(value);
                  setBId(undefined);
                }}
              >
                <SelectTrigger className="min-h-11">
                  <SelectValue placeholder={t("pick_dish")} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleFirstDishes.map((dish) => (
                    <SelectItem key={dish.id} value={dish.id}>
                      {localizedName(dish, lang)} · {dish.place?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-2 text-sm font-semibold">
              <span>{t("dish_b")}</span>
              <Select value={bId} onValueChange={setBId} disabled={!a}>
                <SelectTrigger className="min-h-11">
                  <SelectValue placeholder={t("pick_dish")} />
                </SelectTrigger>
                <SelectContent>
                  {partnerOptions.map((dish) => (
                    <SelectItem key={dish.id} value={dish.id}>
                      {localizedName(dish, lang)} · {dish.place?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {a && b ? (
            <div className="mt-6">
              <div className="mb-4 flex items-center gap-4">
                <span className="h-px flex-1 bg-foreground/25" />
                <p className="label-caps text-primary">{t("which_better")}</p>
                <span className="h-px flex-1 bg-foreground/25" />
              </div>
              <ComparePairChoice
                a={a}
                b={b}
                onCompleted={(winner, loser) => setResult({ winner, loser })}
              />
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
