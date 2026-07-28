import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  followUser,
  getDish,
  listDishes,
  mapsDirectionsUrl,
  myFollowingIds,
  myProfile,
  myTriedIds,
  submitReport,
  toggleTried,
} from "@/lib/dishes.functions";
import { getRequestOrigin } from "@/lib/origin.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { statusLabel, toneClass } from "@/components/DishCard";
import { ShareButton } from "@/components/ShareButton";
import { dishStatusLabel } from "@/lib/dish-status";
import { dict } from "@/lib/i18n";
import { InlineTriedCompare } from "@/components/InlineTriedCompare";

export const Route = createFileRoute("/dish/$id")({
  loader: async ({ params }) => {
    const [dish, origin] = await Promise.all([
      getDish({ data: { id: params.id } }),
      getRequestOrigin(),
    ]);
    return { dish, origin };
  },
  head: ({ params, loaderData }) => {
    const dish: any = loaderData?.dish;
    const origin: string = loaderData?.origin ?? "";
    if (!dish) return { meta: [{ title: "Dish - JaanNee" }] };
    const name = dish.name_en || dish.name_th || "Dish";
    const place = dish.place?.name ?? "";
    const price = dish.price_thb != null ? ` / THB ${Number(dish.price_thb).toFixed(0)}` : "";
    const status = dishStatusLabel(dish, (key) => (dict as any)[key]?.en ?? String(key)).text;
    const baseDescription = `${place}${price} / ${status}`.trim();
    const description = `${name} at ${place || "a Bangkok spot"}${price} — ${status}. See how this dish ranks on JaanNee's dish-by-dish leaderboard.`;
    const pageUrl = origin ? `${origin}/dish/${params.id}` : `/dish/${params.id}`;
    const rawPhoto: string | undefined = dish.photo_url;
    const image = rawPhoto
      ? /^https?:\/\//i.test(rawPhoto)
        ? rawPhoto
        : origin
          ? `${origin}${rawPhoto.startsWith("/") ? "" : "/"}${rawPhoto}`
          : undefined
      : undefined;
    const meta: Array<Record<string, string>> = [
      { title: `${name} - JaanNee` },
      { name: "description", content: description },
      { property: "og:title", content: name },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: pageUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: name },
      { name: "twitter:description", content: description },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }
    const structuredData: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      description: baseDescription || description,
      url: pageUrl,
      category: dish.category?.name_en,
    };
    if (image) structuredData.image = image;
    if (place) structuredData.brand = { "@type": "Brand", name: place };
    if (dish.price_thb != null) {
      structuredData.offers = {
        "@type": "Offer",
        price: Number(dish.price_thb).toFixed(0),
        priceCurrency: "THB",
        availability: "https://schema.org/InStock",
        url: pageUrl,
      };
    }
    return {
      meta,
      links: origin ? [{ rel: "canonical", href: pageUrl }] : [],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(structuredData) }],
    };
  },
  component: DishPage,
});

function DishPage() {
  const { id } = Route.useParams();
  const { origin } = Route.useLoaderData();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const dish = useQuery({ queryKey: ["dish", id], queryFn: () => getDish({ data: { id } }) });
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [comparePromptOpen, setComparePromptOpen] = useState(false);
  const [comparePromptDish, setComparePromptDish] = useState<any | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(Boolean(data.user));
      setUserId(data.user?.id ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session?.user));
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const tried = useQuery({ queryKey: ["tried"], queryFn: () => myTriedIds(), enabled: authed });
  const following = useQuery({
    queryKey: ["following"],
    queryFn: () => myFollowingIds(),
    enabled: authed,
  });
  const comparisonContext = useQuery({
    queryKey: ["profile", "dish-comparison-context"],
    queryFn: () => myProfile(),
    enabled: authed,
  });
  const isTried = (tried.data ?? []).includes(id);
  const pool = useQuery({
    queryKey: ["dish-ranking-pool", dishPoolKey(dish.data)],
    queryFn: () =>
      listDishes({
        data: {
          categorySlug: (dish.data as any).category?.slug,
          subtypeSlug: (dish.data as any).subtype?.slug,
        },
      }),
    enabled: authed && Boolean((dish.data as any)?.category?.slug),
  });

  const eligibleOther = useMemo(() => {
    if (!dish.data || !comparisonContext.isSuccess) return null;
    return findEligibleOtherDish(
      dish.data,
      (pool.data ?? []) as any[],
      tried.data ?? [],
      comparisonContext.data?.compared ?? [],
    );
  }, [dish.data, pool.data, tried.data, comparisonContext.data, comparisonContext.isSuccess]);

  const tryMut = useMutation({
    mutationFn: () => toggleTried({ data: { dishId: id, tried: !isTried } }),
    onSuccess: async () => {
      const markingAsTried = !isTried;
      qc.invalidateQueries({ queryKey: ["tried"] });
      qc.invalidateQueries({ queryKey: ["dishes"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(
        isTried
          ? lang === "th"
            ? "นำออกจากจานที่เคยกินแล้ว"
            : "Removed from tried"
          : lang === "th"
            ? "ทำเครื่องหมายว่าเคยกินแล้ว"
            : "Marked as tried",
      );

      if (!markingAsTried || !dish.data) {
        setComparePromptOpen(false);
        setComparePromptDish(null);
        return;
      }

      const [poolResult, profileResult] = await Promise.all([
        pool.refetch(),
        comparisonContext.refetch(),
      ]);
      const candidate = findEligibleOtherDish(
        dish.data,
        (poolResult.data ?? []) as any[],
        tried.data ?? [],
        profileResult.data?.compared ?? [],
      );
      if (candidate) {
        setComparePromptDish(candidate);
        setComparePromptOpen(true);
      }
    },
    onError: (error: any) => toast.error(error.message),
  });

  const followMut = useMutation({
    mutationFn: ({ targetId, follow }: { targetId: string; follow: boolean }) =>
      followUser({ data: { userId: targetId, follow } }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["following"] });
      toast.success(
        variables.follow
          ? lang === "th"
            ? "กำลังติดตาม"
            : "Following"
          : lang === "th"
            ? "เลิกติดตามแล้ว"
            : "Unfollowed",
      );
    },
    onError: (error: any) => toast.error(error.message),
  });

  if (dish.isLoading) {
    return (
      <AppShell>
        <p className="text-muted-foreground">{t("loading")}</p>
      </AppShell>
    );
  }

  if (!dish.data) {
    return (
      <AppShell>
        <p>{lang === "th" ? "ไม่พบจานนี้" : "Not found."}</p>
      </AppShell>
    );
  }

  const currentDish: any = dish.data;
  const name = lang === "th" && currentDish.name_th ? currentDish.name_th : currentDish.name_en;
  const secondaryName =
    lang === "th" && currentDish.name_th ? currentDish.name_en : currentDish.name_th;
  const areaName = currentDish.place?.area
    ? lang === "th"
      ? currentDish.place.area.name_th || currentDish.place.area.name_en
      : currentDish.place.area.name_en
    : null;
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(currentDish.created_at).getTime()) / 86400000),
  );
  const status = statusLabel(currentDish, t);
  const triedCount = currentDish.tried_count ?? 0;
  const priceLabel =
    currentDish.price_thb != null
      ? lang === "th"
        ? `${Number(currentDish.price_thb).toFixed(0)} ${t("thb")}`
        : `${t("thb")} ${Number(currentDish.price_thb).toFixed(0)}`
      : null;
  const shareUrl = origin
    ? `${origin}/dish/${id}`
    : typeof window !== "undefined"
      ? `${window.location.origin}/dish/${id}`
      : `/dish/${id}`;
  const submitter = currentDish.submitter_profile;
  const submitterName =
    submitter?.display_name ||
    submitter?.username ||
    (lang === "th" ? "นักชิม JaanNee" : "A JaanNee eater");
  const isFollowingSubmitter = currentDish.submitted_by
    ? (following.data ?? []).includes(currentDish.submitted_by)
    : false;

  const finishContextualComparison = () => {
    setComparePromptOpen(false);
    setComparePromptDish(null);
    comparisonContext.refetch();
  };

  return (
    <AppShell>
      <article>
        <div className="relative min-h-[32rem] overflow-hidden border-2 border-foreground bg-ink md:min-h-[43rem]">
          <div className="absolute inset-0 bg-muted">
            {currentDish.photo_url ? (
              <img src={currentDish.photo_url} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-secondary font-display text-5xl italic text-muted-foreground">
                {t("brand")}
              </div>
            )}
          </div>
          <div className="photo-scrim absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 grid gap-6 p-6 text-white md:grid-cols-[1fr_auto] md:items-end md:p-10">
            <div>
              <p className="editorial-kicker text-white/75">
                {lang === "th"
                  ? currentDish.category?.name_th || currentDish.category?.name_en
                  : currentDish.category?.name_en}
              </p>
              <h1 className="type-page-title mt-4 max-w-5xl">{name}</h1>
              {secondaryName ? (
                <p className="mt-3 font-thai text-xl font-medium text-white/75">{secondaryName}</p>
              ) : null}
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.1em] text-white/80">
                {currentDish.place?.name}
                {areaName ? ` / ${areaName}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(status.tone)}`}
              >
                {status.text}
              </span>
              {priceLabel ? (
                <span className="border border-white/40 bg-black/35 px-3 py-2 text-sm font-bold">
                  {priceLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid border-x-2 border-b-2 border-foreground bg-card md:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 md:border-r-2 md:border-foreground md:p-8">
            {currentDish.note ? (
              <p className="border-l-4 border-primary bg-secondary p-5 text-sm leading-7">
                {currentDish.note}
              </p>
            ) : null}

            <h2 className="editorial-kicker mt-8 text-primary">
              {lang === "th" ? "สถิติจาน" : "Dish stats"}
            </h2>
            <div className="mt-4 grid grid-cols-3 border-y-2 border-foreground text-center text-xs text-muted-foreground">
              <Metric label={lang === "th" ? "สถานะ" : "Status"} value={status.text} />
              <Metric
                label={lang === "th" ? "เพิ่มเมื่อ" : "Added"}
                value={lang === "th" ? `${days} วันก่อน` : `${days} ${t("days_ago")}`}
              />
              <Metric label={t("profile_comparisons")} value={`${currentDish.comparisons_count ?? 0}`} />
            </div>
            {triedCount > 0 ? (
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                {t("tried_by")} {triedCount} {t("diners")}
              </p>
            ) : null}

            {authed && isTried && eligibleOther ? (
              <InlineTriedCompare
                dish={currentDish}
                other={eligibleOther}
                onCompared={() => comparisonContext.refetch()}
              />
            ) : null}

            <div className="mt-7 flex flex-wrap gap-2">
              {authed ? (
                <Button
                  variant={isTried ? "secondary" : "default"}
                  onClick={() => tryMut.mutate()}
                  disabled={tryMut.isPending}
                >
                  {isTried ? t("tried_marked") : t("tried_it")}
                </Button>
              ) : (
                <Link to="/auth" search={{ redirect: `/dish/${id}` }}>
                  <Button>
                    {lang === "th"
                      ? "เข้าสู่ระบบเพื่อทำเครื่องหมายว่าเคยกิน"
                      : "Sign in to mark tried"}
                  </Button>
                </Link>
              )}
              <ShareButton
                url={shareUrl}
                title={name}
                text={[currentDish.place?.name, priceLabel, status.text].filter(Boolean).join(" / ")}
                label={t("share")}
              />
              {currentDish.place ? (
                <a href={mapsDirectionsUrl(currentDish.place)} target="_blank" rel="noreferrer">
                  <Button variant="outline" type="button">
                    {lang === "th" ? "เส้นทาง" : "Directions"}
                  </Button>
                </a>
              ) : null}
              {authed ? <ReportDialog dishId={id} /> : null}
            </div>
          </div>

          <aside className="border-t-2 border-foreground p-5 md:border-t-0 md:p-8">
            {currentDish.submitted_by ? (
              <div className="border-y border-foreground/25 py-4">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {lang === "th" ? "เพิ่มโดย" : "Submitted by"}
                </h2>
                <div className="flex items-center justify-between gap-3">
                  <Link
                    to={submitter?.username ? "/u/$username" : "."}
                    params={
                      submitter?.username ? { username: submitter.username } : (undefined as any)
                    }
                    className="flex min-w-0 items-center gap-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {submitter?.avatar_url ? (
                        <img
                          src={submitter.avatar_url}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        submitterName.slice(0, 1)
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {lang === "th" ? `เพิ่มโดย ${submitterName}` : `Posted by ${submitterName}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lang === "th"
                          ? "ติดตามเพื่อดูว่าพวกเขาจะกินอะไรต่อ"
                          : "Follow to see what they eat next."}
                      </p>
                    </div>
                  </Link>
                  {authed && userId !== currentDish.submitted_by ? (
                    <Button
                      variant={isFollowingSubmitter ? "secondary" : "outline"}
                      size="sm"
                      onClick={() =>
                        followMut.mutate({
                          targetId: currentDish.submitted_by,
                          follow: !isFollowingSubmitter,
                        })
                      }
                      disabled={followMut.isPending}
                    >
                      {isFollowingSubmitter
                        ? lang === "th"
                          ? "กำลังติดตาม"
                          : "Following"
                        : lang === "th"
                          ? "ติดตาม"
                          : "Follow"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </article>

      <Drawer
        open={comparePromptOpen && Boolean(comparePromptDish)}
        onOpenChange={(open) => {
          setComparePromptOpen(open);
          if (!open) setComparePromptDish(null);
        }}
      >
        <DrawerContent className="max-h-[92dvh]">
          <div className="mx-auto w-full max-w-3xl overflow-y-auto">
            <DrawerHeader>
              <DrawerTitle>{t("which_better")}</DrawerTitle>
              <DrawerDescription>
                {lang === "th"
                  ? "คุณเคยกินทั้งสองจานแล้ว เลือกจานที่คุณชอบมากกว่า"
                  : "You have tried both dishes. Choose the one you preferred."}
              </DrawerDescription>
            </DrawerHeader>
            {comparePromptDish ? (
              <div className="px-4 pb-2">
                <InlineTriedCompare
                  dish={currentDish}
                  other={comparePromptDish}
                  onCompared={finishContextualComparison}
                />
              </div>
            ) : null}
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="ghost">{lang === "th" ? "ไว้ทีหลัง" : "Not now"}</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}

function dishPoolKey(dish: any) {
  return dish ? [dish.id, dish.category?.slug, dish.subtype_id].join(":") : "none";
}

function comparisonPairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join(":");
}

function findEligibleOtherDish(
  currentDish: any,
  candidates: any[],
  triedIds: string[],
  comparisons: any[],
) {
  if (!currentDish?.id) return null;
  const triedSet = new Set(triedIds);
  const comparedSet = new Set(
    comparisons
      .map((comparison) => {
        const firstId = comparison.lo?.id;
        const secondId = comparison.hi?.id;
        return firstId && secondId ? comparisonPairKey(firstId, secondId) : null;
      })
      .filter(Boolean),
  );
  const currentSubtype = currentDish.subtype_id ?? currentDish.subtype?.id ?? null;

  return (
    candidates.find((candidate) => {
      if (!candidate?.id || candidate.id === currentDish.id || !triedSet.has(candidate.id)) {
        return false;
      }
      if (candidate.category?.id !== currentDish.category?.id) return false;
      const candidateSubtype = candidate.subtype_id ?? candidate.subtype?.id ?? null;
      if (candidateSubtype !== currentSubtype) return false;
      return !comparedSet.has(comparisonPairKey(currentDish.id, candidate.id));
    }) ?? null
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
  const [reason, setReason] = useState("wrong_info");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => submitReport({ data: { dishId, reason, note: note || undefined } }),
    onSuccess: () => {
      toast.success(lang === "th" ? "ขอบคุณ เราจะตรวจสอบรายงานนี้" : "Thanks. We'll review this.");
      setOpen(false);
      setNote("");
    },
    onError: (error: any) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">{t("report")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("report")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wrong_info">
                {lang === "th" ? "ข้อมูลไม่ถูกต้อง" : "Wrong info"}
              </SelectItem>
              <SelectItem value="duplicate">
                {lang === "th" ? "รายการซ้ำ" : "Duplicate"}
              </SelectItem>
              <SelectItem value="place_closed">
                {lang === "th" ? "ร้านปิดแล้ว" : "Place closed"}
              </SelectItem>
              <SelectItem value="other">{lang === "th" ? "อื่นๆ" : "Other"}</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder={lang === "th" ? "รายละเอียดเพิ่มเติม (ไม่บังคับ)" : "Optional details"}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
          />
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {lang === "th" ? "ส่งรายงาน" : "Submit report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
