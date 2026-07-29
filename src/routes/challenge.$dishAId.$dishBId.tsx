import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  ComparePairChoice,
  ComparisonResultPanel,
  type TriedDish,
} from "@/components/ContextualCompare";
import { Button } from "@/components/ui/button";
import {
  getChallengePair,
  myComparedPairKeys,
  myTriedIds,
  recordChallengeResponse,
  toggleTried,
} from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { localizedName, secondaryName } from "@/lib/names";
import { pairKey } from "@/lib/pairing";
import { useAuthUser } from "@/lib/use-auth";

export const Route = createFileRoute("/challenge/$dishAId/$dishBId")({
  validateSearch: (search: Record<string, unknown>): { pick?: string; from?: string } => ({
    pick: typeof search.pick === "string" ? search.pick : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  loader: ({ params }) =>
    getChallengePair({ data: { dishAId: params.dishAId, dishBId: params.dishBId } }),
  head: ({ loaderData }) => {
    if (!loaderData?.ok) {
      return {
        meta: [
          { title: "Dish challenge — JaanNee" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
    const a = loaderData.a;
    const b = loaderData.b;
    const title = `${a?.name_en ?? a?.name_th ?? "Dish"} vs ${b?.name_en ?? b?.name_th ?? "Dish"} — JaanNee`;
    const description =
      "See the shared pick, then compare the two dishes yourself after trying both.";
    const image = a?.photo_url || b?.photo_url;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ChallengePage,
});

function ChallengePage() {
  const { dishAId, dishBId } = Route.useParams();
  const search = Route.useSearch();
  const pair = Route.useLoaderData();
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const auth = useAuthUser();
  const qc = useQueryClient();
  const [result, setResult] = useState<{ winner: TriedDish; loser: TriedDish } | null>(null);

  const tried = useQuery({
    queryKey: ["tried-ids", auth.userId],
    queryFn: () => myTriedIds(),
    enabled: auth.status === "in",
  });
  const compared = useQuery({
    queryKey: ["compared-pairs", auth.userId],
    queryFn: () => myComparedPairKeys(),
    enabled: auth.status === "in",
  });

  const markTried = useMutation({
    mutationFn: (dishId: string) => toggleTried({ data: { dishId, tried: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tried"] });
      qc.invalidateQueries({ queryKey: ["tried-ids"] });
      toast.success(copy("Marked as tried", "ทำเครื่องหมายว่าเคยกินแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!pair.ok || !pair.a || !pair.b) {
    return (
      <AppShell>
        <section className="mx-auto mt-10 max-w-xl rounded-lg border border-border bg-card p-6">
          <h1 className="type-page-title">{t("challenge_unavailable")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("challenge_unavailable_body")}</p>
          <Link to="/">
            <Button className="mt-5 min-h-11">{t("discover_dishes")}</Button>
          </Link>
        </section>
      </AppShell>
    );
  }

  const a = pair.a as TriedDish;
  const b = pair.b as TriedDish;
  const sharedPick = search.pick === a.id || search.pick === b.id ? search.pick : null;
  const challengerUserId = search.from && /^[0-9a-f-]{36}$/i.test(search.from) ? search.from : null;
  const triedIds = tried.data ?? [];
  const aTried = triedIds.includes(a.id);
  const bTried = triedIds.includes(b.id);
  const completed = (compared.data ?? []).includes(pairKey(a.id, b.id));
  const returnParams = new URLSearchParams();
  if (sharedPick) returnParams.set("pick", sharedPick);
  if (challengerUserId) returnParams.set("from", challengerUserId);
  const returnPath = `/challenge/${dishAId}/${dishBId}${returnParams.size ? `?${returnParams}` : ""}`;
  const agreed = result && sharedPick ? result.winner.id === sharedPick : null;

  return (
    <AppShell tone="noir">
      <section className="stitch-masthead text-center md:text-left">
        <div>
          <p className="stitch-kicker">{t("challenge_title")}</p>
          <h1 className="mt-3">{t("do_you_agree")}</h1>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("challenge_intro")}
        </p>
      </section>

      <div className="relative mt-7 grid gap-px bg-white/15 md:grid-cols-2">
        <ChallengeDish dish={a} picked={sharedPick === a.id} />
        <ChallengeDish dish={b} picked={sharedPick === b.id} />
        <span className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#131313] bg-primary font-display text-xl text-white">
          VS
        </span>
      </div>

      {result ? (
        <div className="mt-7 space-y-4">
          {agreed != null ? (
            <div className="rounded-lg border border-border bg-secondary p-4 text-sm font-semibold">
              {agreed ? t("challenge_agree") : t("challenge_disagree")}
            </div>
          ) : null}
          <ComparisonResultPanel winner={result.winner} loser={result.loser} />
        </div>
      ) : auth.status === "loading" ? (
        <p className="mt-7 text-sm text-muted-foreground">{t("loading")}</p>
      ) : auth.status === "out" ? (
        <section className="mt-7 rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t("challenge_sign_in")}</p>
          <Link to="/auth" search={{ redirect: returnPath }}>
            <Button className="mt-4 min-h-11">{t("sign_in")}</Button>
          </Link>
        </section>
      ) : completed ? (
        <section className="mt-7 rounded-lg border border-border bg-card p-5">
          <h2 className="type-section-title">
            {copy("You already compared this pair", "คุณเปรียบเทียบคู่นี้แล้ว")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy(
              "Past comparison choices are permanent and cannot be rewritten.",
              "ผลการเปรียบเทียบเดิมเป็นข้อมูลถาวรและแก้ไขย้อนหลังไม่ได้",
            )}
          </p>
        </section>
      ) : !aTried || !bTried ? (
        <section className="mt-7 rounded-lg border border-border bg-card p-5">
          <h2 className="type-section-title">{t("challenge_mark_tried")}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {!aTried ? (
              <Button
                type="button"
                className="min-h-11"
                onClick={() => markTried.mutate(a.id)}
                disabled={markTried.isPending}
              >
                {t("tried_it")}: {localizedName(a, lang)}
              </Button>
            ) : null}
            {!bTried ? (
              <Button
                type="button"
                className="min-h-11"
                onClick={() => markTried.mutate(b.id)}
                disabled={markTried.isPending}
              >
                {t("tried_it")}: {localizedName(b, lang)}
              </Button>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="mt-7">
          <div className="mb-4 flex items-center gap-4">
            <span className="h-px flex-1 bg-foreground/25" />
            <p className="label-caps text-primary">{t("which_better")}</p>
            <span className="h-px flex-1 bg-foreground/25" />
          </div>
          <ComparePairChoice
            a={a}
            b={b}
            onCompleted={(winner, loser) => {
              setResult({ winner, loser });
              if (challengerUserId && sharedPick && challengerUserId !== auth.userId) {
                void recordChallengeResponse({
                  data: {
                    challengerUserId,
                    dishAId: a.id,
                    dishBId: b.id,
                    winnerId: winner.id,
                    sharedPickId: sharedPick,
                  },
                }).then(() => qc.invalidateQueries({ queryKey: ["retention"] }));
              }
            }}
          />
        </section>
      )}
    </AppShell>
  );
}

function ChallengeDish({ dish, picked }: { dish: TriedDish; picked: boolean }) {
  const { t, lang } = useI18n();
  const name = localizedName(dish, lang);
  const alternate = secondaryName(dish, lang);
  return (
    <article className="overflow-hidden bg-[#1c1b1b]">
      <div className="relative aspect-[4/3] bg-muted">
        {dish.photo_url ? (
          <img
            src={dish.photo_url}
            alt={name}
            width={900}
            height={675}
            className="h-full w-full object-cover"
          />
        ) : null}
        {picked ? (
          <span className="label-caps absolute left-3 top-3 bg-primary px-3 py-2 text-white">
            {t("their_pick")}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <h2 className="type-card-title">{name}</h2>
        {alternate ? (
          <p className="mt-1 font-thai text-sm text-muted-foreground">{alternate}</p>
        ) : null}
        {dish.place?.name ? (
          <p className="mt-2 text-sm text-muted-foreground">{dish.place.name}</p>
        ) : null}
      </div>
    </article>
  );
}
