import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  ComparePairChoice,
  ComparePromptDrawer,
  ComparisonResultPanel,
  type TriedDish,
  useComparePairs,
} from "@/components/ContextualCompare";
import { DishCard, statusLabel, toneClass } from "@/components/DishCard";
import { HowRankingWorks } from "@/components/HowRankingWorks";
import { RankingShare } from "@/components/RankingShare";
import { FoodPostCreator } from "@/components/FoodPostCreator";
import { RestaurantConnection } from "@/components/RestaurantConnection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  followUser,
  getDish,
  leaderboard,
  mapsDirectionsUrl,
  myFollowingIds,
  myTriedIds,
  myWantToTryIds,
  setWantToTry,
  submitReport,
  toggleTried,
  updateSubmittedDishPrice,
} from "@/lib/dishes.functions";
import { dishStatusLabel } from "@/lib/dish-status";
import { dict, useI18n } from "@/lib/i18n";
import { localizedName, secondaryName } from "@/lib/names";
import { getRequestOrigin } from "@/lib/origin.functions";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";
import { useAuthUser } from "@/lib/use-auth";
import { getPublicRestaurantSummary } from "@/lib/restaurant.functions";

type DishDetail = TriedDish & {
  status?: string | null;
  requested_category_en?: string | null;
  requested_category_th?: string | null;
  note?: string | null;
  price_thb?: number | null;
  created_at?: string | null;
  comparisons_count?: number | null;
  tried_count?: number | null;
  elo?: number | null;
  needs_update?: boolean | null;
  submitted_by?: string | null;
  category?: TriedDish["category"] & {
    slug?: string | null;
    name_en?: string | null;
    name_th?: string | null;
  };
  subtype?: TriedDish["subtype"] & {
    slug?: string | null;
    name_en?: string | null;
    name_th?: string | null;
  };
  place?: {
    id?: string | null;
    name?: string | null;
    address?: string | null;
    google_maps_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    area?: {
      name_en?: string | null;
      name_th?: string | null;
    } | null;
  } | null;
  submitter_profile?: {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

export const Route = createFileRoute("/dish/$id")({
  loader: async ({ params }) => {
    const [dish, origin] = await Promise.all([
      getDish({ data: { id: params.id } }),
      getRequestOrigin(),
    ]);
    return { dish, origin };
  },
  head: ({ params, loaderData }) => {
    const dish = loaderData?.dish as DishDetail | undefined;
    const origin = loaderData?.origin ?? "";
    if (!dish) return { meta: [{ title: "Dish — JaanNee" }] };
    const name = dish.name_en || dish.name_th || "Dish";
    const place = dish.place?.name ?? "";
    const price = dish.price_thb != null ? ` · THB ${Number(dish.price_thb).toFixed(0)}` : "";
    const status = dishStatusLabel(dish, (key) => dict[key]?.en ?? String(key)).text;
    const description = `${name} at ${place || "a Bangkok spot"}${price}. ${status} on JaanNee's dish leaderboard.`;
    const pageUrl = origin ? `${origin}/dish/${params.id}` : `/dish/${params.id}`;
    const photo = dish.photo_url
      ? /^https?:\/\//i.test(dish.photo_url)
        ? dish.photo_url
        : origin
          ? `${origin}${dish.photo_url.startsWith("/") ? "" : "/"}${dish.photo_url}`
          : undefined
      : undefined;
    const menuItem = {
      "@context": "https://schema.org",
      "@type": "MenuItem",
      name,
      description,
      url: pageUrl,
      image: photo,
      offers:
        dish.price_thb != null
          ? {
              "@type": "Offer",
              price: Number(dish.price_thb).toFixed(0),
              priceCurrency: "THB",
              url: pageUrl,
            }
          : undefined,
    };
    return {
      meta: [
        { title: `${name} — JaanNee` },
        { name: "description", content: description },
        { property: "og:title", content: name },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: pageUrl },
        ...(photo ? [{ property: "og:image", content: photo }] : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: origin ? [{ rel: "canonical", href: pageUrl }] : [],
      scripts: [{ type: "application/ld+json", children: safeJsonLd(menuItem) }],
    };
  },
  component: DishPage,
});

function DishPage() {
  const { id } = Route.useParams();
  const { origin, dish: loadedDish } = Route.useLoaderData();
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const qc = useQueryClient();
  const auth = useAuthUser();
  const comparison = useComparePairs();
  const dishQuery = useQuery({
    queryKey: ["dish", id],
    queryFn: () => getDish({ data: { id } }),
    initialData: loadedDish,
    staleTime: 60_000,
  });
  const dish = dishQuery.data as DishDetail | undefined;
  const officialRestaurant = useQuery({
    queryKey: ["public-restaurant-profile", dish?.place?.id],
    queryFn: () => getPublicRestaurantSummary({ data: { placeId: dish!.place!.id! } }),
    enabled: Boolean(dish?.place?.id),
    staleTime: 5 * 60_000,
  });
  const tried = useQuery({
    queryKey: ["tried-ids", auth.userId],
    queryFn: () => myTriedIds(),
    enabled: auth.status === "in",
  });
  const wantToTry = useQuery({
    queryKey: ["want-to-try", auth.userId],
    queryFn: () => myWantToTryIds(),
    enabled: auth.status === "in",
  });
  const following = useQuery({
    queryKey: ["following", auth.userId],
    queryFn: () => myFollowingIds(),
    enabled: auth.status === "in",
  });
  const rankPool = useQuery({
    queryKey: ["dish-rank", id, dish?.category?.slug, dish?.subtype?.slug],
    queryFn: () =>
      leaderboard({
        data: {
          categorySlug: dish!.category!.slug!,
          subtypeSlug: dish?.subtype?.slug ?? undefined,
          minimumComparisons: PUBLIC_RANK_THRESHOLD,
        },
      }),
    enabled:
      Number(dish?.comparisons_count ?? 0) >= PUBLIC_RANK_THRESHOLD &&
      Boolean(dish?.category?.slug),
  });

  const [promptRequested, setPromptRequested] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptPartner, setPromptPartner] = useState<TriedDish | null>(null);
  const [inlineResult, setInlineResult] = useState<{
    winner: TriedDish;
    loser: TriedDish;
  } | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceValue, setPriceValue] = useState("");

  const triedIds = tried.data ?? [];
  const isTried = triedIds.includes(id);
  const isSaved = (wantToTry.data ?? []).includes(id);
  const currentTriedDish = comparison.dishes.find((item) => item.id === id) ?? dish ?? null;
  const eligiblePartner = comparison.partnersFor(id)[0] ?? null;

  useEffect(() => {
    if (!promptRequested || !currentTriedDish || !eligiblePartner) return;
    setPromptPartner(eligiblePartner);
    setPromptOpen(true);
    setPromptRequested(false);
  }, [currentTriedDish, eligiblePartner, promptRequested]);

  const tryMutation = useMutation({
    mutationFn: (nextTried: boolean) => toggleTried({ data: { dishId: id, tried: nextTried } }),
    onSuccess: async (_result, nextTried) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tried"] }),
        qc.invalidateQueries({ queryKey: ["tried-ids"] }),
        qc.invalidateQueries({ queryKey: ["dishes"] }),
        qc.invalidateQueries({ queryKey: ["profile"] }),
        qc.invalidateQueries({ queryKey: ["want-to-try"] }),
      ]);
      toast.success(
        nextTried
          ? copy("Marked as tried", "ทำเครื่องหมายว่าเคยกินแล้ว")
          : copy("Removed from tried dishes", "นำออกจากจานที่เคยกินแล้ว"),
      );
      if (nextTried) setPromptRequested(true);
      else {
        setPromptOpen(false);
        setPromptPartner(null);
        setInlineResult(null);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const wantMutation = useMutation({
    mutationFn: (saved: boolean) => setWantToTry({ data: { dishId: id, saved } }),
    onSuccess: async (_result, saved) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["want-to-try"] }),
        qc.invalidateQueries({ queryKey: ["profile"] }),
      ]);
      toast.success(saved ? t("saved_for_later") : t("remove_from_saved"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const followMutation = useMutation({
    mutationFn: ({ targetId, follow }: { targetId: string; follow: boolean }) =>
      followUser({ data: { userId: targetId, follow } }),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ["following"] });
      toast.success(
        variables.follow ? copy("Following", "ติดตามแล้ว") : copy("Unfollowed", "เลิกติดตามแล้ว"),
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const priceMutation = useMutation({
    mutationFn: () =>
      updateSubmittedDishPrice({
        data: {
          dishId: id,
          priceThb: priceValue.trim() ? Number(priceValue) : null,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dish", id] }),
        qc.invalidateQueries({ queryKey: ["dishes"] }),
        qc.invalidateQueries({ queryKey: ["profile"] }),
      ]);
      setPriceOpen(false);
      toast.success(copy("Price updated", "อัปเดตราคาแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (dishQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-muted-foreground">{t("loading")}</p>
      </AppShell>
    );
  }
  if (!dish) {
    return (
      <AppShell>
        <p>{copy("Not found.", "ไม่พบจานนี้")}</p>
      </AppShell>
    );
  }

  const name = localizedName(dish, lang);
  const alternateName = secondaryName(dish, lang);
  const areaName = localizedName(dish.place?.area, lang);
  const days = dish.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(dish.created_at).getTime()) / 86400000))
    : 0;
  const isApproved = dish.status === "approved";
  const status = isApproved
    ? statusLabel(dish, t)
    : {
        text: copy("Awaiting review", "รอตรวจสอบ"),
        tone: "amber" as const,
      };
  const triedCount = Number(dish.tried_count ?? 0);
  const shareUrl = origin
    ? `${origin}/dish/${id}`
    : typeof window !== "undefined"
      ? `${window.location.origin}/dish/${id}`
      : `/dish/${id}`;
  const rank =
    Number(dish.comparisons_count ?? 0) >= PUBLIC_RANK_THRESHOLD
      ? (rankPool.data ?? []).findIndex((item: { id: string }) => item.id === id) + 1
      : 0;
  const submitter = dish.submitter_profile;
  const submitterName =
    submitter?.display_name || submitter?.username || copy("A JaanNee diner", "นักชิม JaanNee");
  const isFollowingSubmitter = dish.submitted_by
    ? (following.data ?? []).includes(dish.submitted_by)
    : false;

  return (
    <AppShell tone="noir" fullBleed>
      <article className="stitch-page">
        <div className="relative min-h-[72svh] overflow-hidden bg-black md:min-h-[82svh]">
          <div className="absolute inset-0 bg-muted">
            {dish.photo_url ? (
              <img
                src={dish.photo_url}
                alt={name}
                width={1400}
                height={1050}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-secondary font-display text-5xl italic text-muted-foreground">
                {t("photo_needed")}
              </div>
            )}
          </div>
          <div className="photo-scrim absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 grid gap-6 p-6 text-white md:grid-cols-[1fr_auto] md:items-end md:p-10">
            <div>
              <p className="editorial-kicker text-white/75">
                {localizedName(dish.category, lang) ||
                  (lang === "th"
                    ? dish.requested_category_th || dish.requested_category_en
                    : dish.requested_category_en || dish.requested_category_th)}
                {dish.subtype ? ` · ${localizedName(dish.subtype, lang)}` : ""}
              </p>
              <h1 className="mt-4 max-w-5xl font-display text-[clamp(3.5rem,10vw,9rem)] leading-[0.82] tracking-[-0.045em]">
                {name}
              </h1>
              {alternateName ? (
                <p className="mt-3 font-thai text-xl font-medium text-white/75">{alternateName}</p>
              ) : null}
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.1em] text-white/80">
                {dish.place?.name}
                {areaName ? ` · ${areaName}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end md:pb-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(status.tone)}`}
              >
                {status.text}
              </span>
              {rank > 0 ? (
                <span className="border border-gold bg-black/45 px-3 py-2 text-sm font-bold text-gold">
                  #{rank}
                </span>
              ) : null}
              {dish.price_thb != null ? (
                <span className="border border-white/40 bg-black/35 px-3 py-2 text-sm font-bold">
                  THB {Number(dish.price_thb).toFixed(0)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="stitch-container grid bg-[#131313] lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
          <div className="py-8 lg:border-r lg:border-white/10 lg:py-14 lg:pr-12">
            {dish.note ? (
              <p className="border-l-4 border-primary bg-secondary p-5 text-sm leading-7">
                {dish.note}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
              <h2 className="editorial-kicker text-primary">{copy("Dish stats", "ข้อมูลจาน")}</h2>
              <HowRankingWorks
                comparisonsCount={Number(dish.comparisons_count ?? 0)}
                triedCount={triedCount}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 border-y-2 border-foreground text-center text-xs text-muted-foreground">
              <Metric label={copy("Status", "สถานะ")} value={status.text} />
              <Metric label={copy("Added", "เพิ่มเมื่อ")} value={`${days} ${t("days_ago")}`} />
              <Metric label={t("comparisons_progress")} value={`${dish.comparisons_count ?? 0}`} />
            </div>
            {triedCount > 0 ? (
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                {t("tried_by")} {triedCount} {t(triedCount === 1 ? "diner" : "diners")}
              </p>
            ) : null}

            {auth.status === "in" && isTried && currentTriedDish && eligiblePartner ? (
              <section className="mt-8 border-t border-border pt-6">
                <p className="label-caps text-primary">{t("ready_to_compare")}</p>
                <h2 className="type-section-title mt-2">{t("which_better")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t("ready_to_compare_body")}</p>
                <div className="mt-4">
                  {inlineResult ? (
                    <ComparisonResultPanel
                      winner={inlineResult.winner}
                      loser={inlineResult.loser}
                    />
                  ) : (
                    <ComparePairChoice
                      a={currentTriedDish}
                      b={eligiblePartner}
                      onCompleted={(winner, loser) => setInlineResult({ winner, loser })}
                    />
                  )}
                </div>
              </section>
            ) : auth.status === "in" && isTried && !comparison.isLoading && dish.category?.slug ? (
              <section className="mt-8 border-t border-border pt-6">
                <p className="label-caps text-primary">{t("no_pairs_yet")}</p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  {t("no_pairs_yet_body")}
                </p>
                <Link
                  to="/"
                  search={{ category: dish.category.slug }}
                  className="mt-4 inline-flex min-h-11 items-center border border-foreground px-4 py-2 text-xs font-bold uppercase tracking-wide transition hover:bg-foreground hover:text-background"
                >
                  {copy(
                    `Find another ${localizedName(dish.category, lang)}`,
                    `ค้นหา${localizedName(dish.category, lang)}จานอื่น`,
                  )}
                </Link>
              </section>
            ) : null}

            <div className="sticky bottom-20 z-20 -mx-4 mt-8 flex gap-2 overflow-x-auto border-y border-white/10 bg-[#131313]/95 px-4 py-3 backdrop-blur-xl md:static md:mx-0 md:flex-wrap md:border-0 md:bg-transparent md:px-0 md:py-0">
              {isApproved && auth.status === "in" ? (
                <Button
                  variant={isTried ? "secondary" : "default"}
                  onClick={() => tryMutation.mutate(!isTried)}
                  disabled={tryMutation.isPending}
                  className="min-h-11"
                >
                  {isTried ? t("tried_marked") : t("tried_it")}
                </Button>
              ) : isApproved ? (
                <Link to="/auth" search={{ redirect: `/dish/${id}` }}>
                  <Button className="min-h-11">
                    {copy("Sign in to mark tried", "เข้าสู่ระบบเพื่อทำเครื่องหมายว่าเคยกิน")}
                  </Button>
                </Link>
              ) : null}
              {isApproved && auth.status === "in" && !isTried ? (
                <Button
                  variant={isSaved ? "secondary" : "outline"}
                  onClick={() => wantMutation.mutate(!isSaved)}
                  disabled={wantMutation.isPending}
                  className="min-h-11"
                >
                  {isSaved ? t("saved_for_later") : t("want_to_try")}
                </Button>
              ) : null}
              <FoodPostCreator dish={dish} url={shareUrl} isTried={isTried} isSaved={isSaved} />
              {rank > 0 ? <RankingShare dish={dish} rank={rank} /> : null}
              {auth.status === "in" && auth.userId === dish.submitted_by ? (
                <Dialog
                  open={priceOpen}
                  onOpenChange={(open) => {
                    setPriceOpen(open);
                    if (open) {
                      setPriceValue(
                        dish.price_thb != null ? String(Math.round(Number(dish.price_thb))) : "",
                      );
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" type="button" className="min-h-11">
                      {dish.price_thb == null
                        ? copy("Add price", "เพิ่มราคา")
                        : copy("Edit price", "แก้ไขราคา")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>
                        {dish.price_thb == null
                          ? copy("Add the price", "เพิ่มราคา")
                          : copy("Update the price", "อัปเดตราคา")}
                      </DialogTitle>
                    </DialogHeader>
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        priceMutation.mutate();
                      }}
                    >
                      <div className="relative">
                        <Input
                          autoFocus
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100000}
                          step={1}
                          value={priceValue}
                          onChange={(event) => setPriceValue(event.target.value)}
                          placeholder={copy("Optional", "ไม่บังคับ")}
                          aria-label={copy("Price in Thai baht", "ราคาเป็นเงินบาท")}
                          className="h-12 pr-16 text-base"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted-foreground">
                          THB
                        </span>
                      </div>
                      <Button
                        type="submit"
                        className="h-11 w-full"
                        disabled={priceMutation.isPending}
                      >
                        {priceMutation.isPending ? t("saving") : copy("Save price", "บันทึกราคา")}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : null}
              {dish.place ? (
                <a href={mapsDirectionsUrl(dish.place)} target="_blank" rel="noreferrer">
                  <Button variant="outline" type="button" className="min-h-11">
                    {copy("Directions", "เส้นทาง")}
                  </Button>
                </a>
              ) : null}
              {officialRestaurant.data && dish.place?.id ? (
                <Link to="/place/$placeId" params={{ placeId: dish.place.id }}>
                  <Button variant="outline" type="button" className="min-h-11">
                    {copy("Official restaurant profile", "โปรไฟล์ร้านทางการ")}
                  </Button>
                </Link>
              ) : null}
              {auth.status === "in" ? <ReportDialog dishId={id} /> : null}
            </div>
            <RestaurantConnection
              placeId={dish.place?.id}
              placeName={dish.place?.name}
              dishId={dish.id}
              eligible={auth.status === "in" && (isTried || isSaved)}
            />
          </div>

          <aside className="space-y-8 py-8 lg:py-14 lg:pl-12">
            {dish.submitted_by ? (
              <div className="border-y border-foreground/25 py-4">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {copy("Submitted by", "ส่งโดย")}
                </h2>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {submitter?.avatar_url ? (
                        <img
                          src={submitter.avatar_url}
                          alt=""
                          width={40}
                          height={40}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        submitterName.slice(0, 1)
                      )}
                    </div>
                    <div>
                      {submitter?.username ? (
                        <Link
                          to="/u/$username"
                          params={{ username: submitter.username }}
                          className="text-sm font-semibold hover:underline"
                        >
                          {submitterName}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold">{submitterName}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {copy(
                          "Follow to see what they eat next.",
                          "ติดตามเพื่อดูว่าพวกเขากินอะไรต่อ",
                        )}
                      </p>
                    </div>
                  </div>
                  {auth.status === "in" && auth.userId !== dish.submitted_by ? (
                    <Button
                      variant={isFollowingSubmitter ? "secondary" : "outline"}
                      size="sm"
                      onClick={() =>
                        followMutation.mutate({
                          targetId: dish.submitted_by!,
                          follow: !isFollowingSubmitter,
                        })
                      }
                      disabled={followMutation.isPending}
                    >
                      {isFollowingSubmitter
                        ? copy("Following", "กำลังติดตาม")
                        : copy("Follow", "ติดตาม")}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {rankPool.data && rankPool.data.length > 1 ? (
              <section>
                <h2 className="type-section-title">
                  {copy("More in this ranking", "จานอื่นในอันดับนี้")}
                </h2>
                <div className="mt-4 space-y-4">
                  {rankPool.data
                    .filter((item: { id: string }) => item.id !== id)
                    .slice(0, 2)
                    .map((item) => (
                      <DishCard key={item.id} dish={item} />
                    ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </article>

      <ComparePromptDrawer
        open={promptOpen}
        onOpenChange={setPromptOpen}
        a={currentTriedDish}
        b={promptPartner}
      />
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-foreground/20 px-2 py-4 last:border-r-0">
      <div className="type-stat text-foreground">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ReportDialog({ dishId }: { dishId: string }) {
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const [reason, setReason] = useState("wrong_info");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => submitReport({ data: { dishId, reason, note: note || undefined } }),
    onSuccess: () => {
      toast.success(copy("Thanks. We will review this.", "ขอบคุณ เราจะตรวจสอบข้อมูลนี้"));
      setOpen(false);
      setNote("");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          {t("report")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("report")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wrong_info">
                {copy("Wrong information", "ข้อมูลไม่ถูกต้อง")}
              </SelectItem>
              <SelectItem value="duplicate">{copy("Duplicate", "ซ้ำ")}</SelectItem>
              <SelectItem value="place_closed">{copy("Place closed", "ร้านปิดแล้ว")}</SelectItem>
              <SelectItem value="other">{copy("Other", "อื่นๆ")}</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder={copy("Optional details", "รายละเอียดเพิ่มเติม")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
          />
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {copy("Submit report", "ส่งรายงาน")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
