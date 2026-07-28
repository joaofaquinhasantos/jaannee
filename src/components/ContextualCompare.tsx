import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useI18n } from "@/lib/i18n";
import { useAuthUser } from "@/lib/use-auth";
import {
  listCurrentUserTriedDishes,
  myComparedPairKeys,
  submitComparison,
} from "@/lib/dishes.functions";
import {
  eligiblePartnersFor,
  firstEligiblePair,
  type PairDish,
} from "@/lib/pairing";
import { localizedName, placeDisplayName } from "@/lib/names";
import { buildComparisonCard, challengeUrl, type ShareDish } from "@/lib/share-card";
import { ShareCardActions } from "@/components/ShareCardActions";

export type TriedDish = PairDish &
  ShareDish & {
    place?: { id?: string | null; name?: string | null } | null;
  };

/**
 * Everything contextual comparisons need: the diner's tried dishes and the
 * pairs they already completed. Private keys are scoped by user id so a
 * different account can never read a cached result.
 */
export function useComparePairs() {
  const { userId, status } = useAuthUser();
  const enabled = status === "in";
  const tried = useQuery({
    queryKey: ["tried", "current-user", userId],
    queryFn: () => listCurrentUserTriedDishes(),
    enabled,
  });
  const compared = useQuery({
    queryKey: ["compared-pairs", userId],
    queryFn: () => myComparedPairKeys(),
    enabled,
  });
  const dishes = (tried.data ?? []) as TriedDish[];
  const comparedKeys = (compared.data ?? []) as string[];
  return {
    authStatus: status,
    userId,
    isLoading: enabled && (tried.isLoading || compared.isLoading),
    dishes,
    comparedKeys,
    nextPair: useMemo(() => firstEligiblePair(dishes, comparedKeys), [dishes, comparedKeys]),
    partnersFor: useCallback(
      (dishId: string) => eligiblePartnersFor(dishId, dishes, comparedKeys),
      [dishes, comparedKeys],
    ),
  };
}

/** Invalidate everything a completed comparison can change. */
export function useComparisonInvalidation() {
  const qc = useQueryClient();
  return useCallback(() => {
    for (const key of [
      ["tried"],
      ["compared-pairs"],
      ["dishes"],
      ["dish"],
      ["leaderboard"],
      ["rankings-unranked"],
      ["profile"],
      ["challenge"],
    ]) {
      qc.invalidateQueries({ queryKey: key });
    }
  }, [qc]);
}

function DishPanel({
  dish,
  onPick,
  disabled,
}: {
  dish: TriedDish;
  onPick: () => void;
  disabled: boolean;
}) {
  const { t, lang } = useI18n();
  const name = localizedName(dish, lang);
  const place = placeDisplayName(dish.place);
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative aspect-[4/3] w-full bg-muted">
        {dish.photo_url ? (
          <img
            src={dish.photo_url}
            alt={name}
            width={800}
            height={600}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("photo_needed")}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-display text-xl leading-tight">{name}</p>
        {place ? <p className="text-sm text-muted-foreground">{place}</p> : null}
      </div>
      <Button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="min-h-12 rounded-none"
        aria-label={`${t("i_prefer_this")}: ${name}`}
      >
        {disabled ? t("saving") : t("i_prefer_this")}
      </Button>
    </div>
  );
}

/** Two dishes side by side with a "which did you prefer" choice. */
export function ComparePairChoice({
  a,
  b,
  onCompleted,
  onDismiss,
}: {
  a: TriedDish;
  b: TriedDish;
  onCompleted?: (winner: TriedDish, loser: TriedDish) => void;
  onDismiss?: () => void;
}) {
  const { t } = useI18n();
  const invalidate = useComparisonInvalidation();
  const [pending, setPending] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (winnerId: string) =>
      submitComparison({ data: { dishAId: a.id, dishBId: b.id, winnerId } }),
    onMutate: (winnerId: string) => setPending(winnerId),
    onSuccess: (_res, winnerId) => {
      toast.success(t("comparison_saved"));
      invalidate();
      onCompleted?.(winnerId === a.id ? a : b, winnerId === a.id ? b : a);
    },
    onError: (error: Error) => toast.error(error.message || t("error_generic")),
    onSettled: () => setPending(null),
  });

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DishPanel dish={a} disabled={pending != null} onPick={() => mutation.mutate(a.id)} />
        <DishPanel dish={b} disabled={pending != null} onPick={() => mutation.mutate(b.id)} />
      </div>
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onDismiss}
          className="mt-3 min-h-11 w-full text-sm"
        >
          {t("not_now")}
        </Button>
      ) : null}
    </div>
  );
}

/** Result panel with a real, shareable challenge deep link. */
export function ComparisonResultPanel({
  winner,
  loser,
  dinerLabel,
}: {
  winner: TriedDish;
  loser: TriedDish;
  dinerLabel?: string | null;
}) {
  const { t, lang } = useI18n();
  const origin = typeof window !== "undefined" ? window.location.origin : "https://jaannee.lovable.app";
  const url = challengeUrl(origin, winner.id, loser.id);
  const model = buildComparisonCard({ lang, winner, loser, dinerLabel, url });

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
        {t("you_picked")}
      </p>
      <h2 className="mt-2 font-display text-2xl leading-tight">{model.winnerName}</h2>
      {model.winnerPlace ? (
        <p className="text-sm text-muted-foreground">{model.winnerPlace}</p>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">
        {model.versus} {model.loserName}
        {model.loserPlace ? ` — ${model.loserPlace}` : ""}
      </p>
      {model.pool ? (
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {model.pool}
        </p>
      ) : null}
      <p className="mt-4 font-display text-xl">{t("do_you_agree")}</p>
      <div className="mt-4">
        <ShareCardActions model={model} filenameBase={`jaannee-${winner.id.slice(0, 8)}`} />
      </div>
    </section>
  );
}

/**
 * Bottom drawer that opens as soon as a diner marks a second dish in the same
 * ranking pool as tried.
 */
export function ComparePromptDrawer({
  open,
  onOpenChange,
  a,
  b,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  a: TriedDish | null;
  b: TriedDish | null;
}) {
  const { t } = useI18n();
  const [result, setResult] = useState<{ winner: TriedDish; loser: TriedDish } | null>(null);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) setResult(null);
        onOpenChange(next);
      }}
    >
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl px-4 pb-8">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle>{result ? t("share_result") : t("which_better")}</DrawerTitle>
          </DrawerHeader>
          {result ? (
            <ComparisonResultPanel winner={result.winner} loser={result.loser} />
          ) : a && b ? (
            <ComparePairChoice
              a={a}
              b={b}
              onCompleted={(winner, loser) => setResult({ winner, loser })}
              onDismiss={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** "Ready to compare" block for My Dishes. */
export function ReadyToComparePanel() {
  const { t } = useI18n();
  const { nextPair, isLoading, authStatus } = useComparePairs();
  const [result, setResult] = useState<{ winner: TriedDish; loser: TriedDish } | null>(null);

  if (authStatus !== "in") return null;

  return (
    <section className="rounded-lg border-2 border-foreground bg-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
        {t("ready_to_compare")}
      </p>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("loading")}</p>
      ) : result ? (
        <div className="mt-4 space-y-4">
          <ComparisonResultPanel winner={result.winner} loser={result.loser} />
          <Button variant="outline" className="min-h-11" onClick={() => setResult(null)}>
            {t("done")}
          </Button>
        </div>
      ) : nextPair ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{t("ready_to_compare_body")}</p>
          <div className="mt-4">
            <ComparePairChoice
              a={nextPair.a as TriedDish}
              b={nextPair.b as TriedDish}
              onCompleted={(winner, loser) => setResult({ winner, loser })}
            />
          </div>
        </>
      ) : (
        <>
          <h3 className="mt-2 font-display text-xl">{t("no_pairs_yet")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("no_pairs_yet_body")}</p>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="outline" className="min-h-11">
              {t("discover_dishes")}
            </Button>
          </Link>
        </>
      )}
    </section>
  );
}
