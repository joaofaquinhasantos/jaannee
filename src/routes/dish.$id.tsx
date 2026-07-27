import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  followUser,
  getDish,
  listDishes,
  mapsDirectionsUrl,
  myFollowingIds,
  myTriedIds,
  submitReport,
  toggleTried,
} from "@/lib/dishes.functions";
import { getRequestOrigin } from "@/lib/origin.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
    const d: any = loaderData?.dish;
    const origin: string = loaderData?.origin ?? "";
    if (!d) return { meta: [{ title: "Dish - JaanNee" }] };
    const name = d.name_en || d.name_th || "Dish";
    const place = d.place?.name ?? "";
    const price = d.price_thb != null ? ` / THB ${Number(d.price_thb).toFixed(0)}` : "";
    const status = dishStatusLabel(d, (k) => (dict as any)[k]?.en ?? String(k)).text;
    const baseDesc = `${place}${price} / ${status}`.trim();
    const desc = `${name} at ${place || "a Bangkok spot"}${price} — ${status}. See how this dish ranks on JaanNee's dish-by-dish leaderboard.`;
    const pageUrl = origin ? `${origin}/dish/${params.id}` : `/dish/${params.id}`;
    const rawPhoto: string | undefined = d.photo_url;
    const ogImage = rawPhoto
      ? /^https?:\/\//i.test(rawPhoto)
        ? rawPhoto
        : origin
          ? `${origin}${rawPhoto.startsWith("/") ? "" : "/"}${rawPhoto}`
          : undefined
      : undefined;
    const meta: Array<Record<string, string>> = [
      { title: `${name} - JaanNee` },
      { name: "description", content: desc },
      { property: "og:title", content: name },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:url", content: pageUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: name },
      { name: "twitter:description", content: desc },
    ];
    if (ogImage) {
      meta.push({ property: "og:image", content: ogImage });
      meta.push({ name: "twitter:image", content: ogImage });
    }
    const productLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      description: baseDesc || desc,
      url: pageUrl,
      category: d.category?.name_en,
    };
    if (ogImage) productLd.image = ogImage;
    if (place) productLd.brand = { "@type": "Brand", name: place };
    if (d.price_thb != null) {
      productLd.offers = {
        "@type": "Offer",
        price: Number(d.price_thb).toFixed(0),
        priceCurrency: "THB",
        availability: "https://schema.org/InStock",
        url: pageUrl,
      };
    }
    return {
      meta,
      links: origin ? [{ rel: "canonical", href: pageUrl }] : [],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(productLd) }],
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
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s?.user);
      setUserId(s?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const tried = useQuery({ queryKey: ["tried"], queryFn: () => myTriedIds(), enabled: authed });
  const following = useQuery({
    queryKey: ["following"],
    queryFn: () => myFollowingIds(),
    enabled: authed,
  });
  const isTried = (tried.data ?? []).includes(id);
  const pool = useQuery({
    queryKey: ["dish-ranking-pool", dKey(dish.data)],
    queryFn: () =>
      listDishes({
        data: {
          categorySlug: (dish.data as any).category?.slug,
          subtypeSlug: (dish.data as any).subtype?.slug,
        },
      }),
    enabled: authed && isTried && !!(dish.data as any)?.category?.slug,
  });

  const tryMut = useMutation({
    mutationFn: () => toggleTried({ data: { dishId: id, tried: !isTried } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tried"] });
      qc.invalidateQueries({ queryKey: ["dishes"] });
      toast.success(isTried ? "Removed from tried" : "Marked as tried");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const followMut = useMutation({
    mutationFn: ({ targetId, follow }: { targetId: string; follow: boolean }) =>
      followUser({ data: { userId: targetId, follow } }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["following"] });
      toast.success(vars.follow ? "Following" : "Unfollowed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (dish.isLoading)
    return (
      <AppShell>
        <p className="text-muted-foreground">{t("loading")}</p>
      </AppShell>
    );
  if (!dish.data)
    return (
      <AppShell>
        <p>Not found.</p>
      </AppShell>
    );

  const d: any = dish.data;
  const name = lang === "th" && d.name_th ? d.name_th : d.name_en;
  const secondaryName = lang === "th" && d.name_th ? d.name_en : d.name_th;
  const areaName = d.place?.area
    ? lang === "th"
      ? d.place.area.name_th
      : d.place.area.name_en
    : null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000));
  const s = statusLabel(d, t);
  const triedCount = d.tried_count ?? 0;
  const shareUrl = origin
    ? `${origin}/dish/${id}`
    : typeof window !== "undefined"
      ? `${window.location.origin}/dish/${id}`
      : `/dish/${id}`;
  const otherTried = ((pool.data ?? []) as any[]).find(
    (candidate) =>
      candidate.id !== d.id &&
      (tried.data ?? []).includes(candidate.id) &&
      (d.subtype_id ? candidate.subtype_id === d.subtype_id : !candidate.subtype_id),
  );
  const submitter = d.submitter_profile;
  const submitterName = submitter?.display_name || submitter?.username || "A JaanNee eater";
  const isFollowingSubmitter = d.submitted_by
    ? (following.data ?? []).includes(d.submitted_by)
    : false;

  return (
    <AppShell>
      <article>
        <div className="relative min-h-[32rem] overflow-hidden border-2 border-foreground bg-ink md:min-h-[43rem]">
          <div className="absolute inset-0 bg-muted">
            {d.photo_url ? (
              <img src={d.photo_url} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-secondary font-display text-5xl italic text-muted-foreground">
                JaanNee
              </div>
            )}
          </div>
          <div className="photo-scrim absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 grid gap-6 p-6 text-white md:grid-cols-[1fr_auto] md:items-end md:p-10">
            <div>
              <p className="editorial-kicker text-white/75">
                {lang === "th" ? d.category?.name_th : d.category?.name_en}
              </p>
              <h1 className="type-page-title mt-4 max-w-5xl">{name}</h1>
              {secondaryName ? (
                <p className="mt-3 font-thai text-xl font-medium text-white/75">{secondaryName}</p>
              ) : null}
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.1em] text-white/80">
                {d.place?.name}
                {areaName ? ` / ${areaName}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(s.tone)}`}
              >
                {s.text}
              </span>
              {d.price_thb != null && (
                <span className="border border-white/40 bg-black/35 px-3 py-2 text-sm font-bold">
                  THB {Number(d.price_thb).toFixed(0)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid border-x-2 border-b-2 border-foreground bg-card md:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 md:border-r-2 md:border-foreground md:p-8">
            {d.note && (
              <p className="border-l-4 border-primary bg-secondary p-5 text-sm leading-7">
                {d.note}
              </p>
            )}

            <h2 className="editorial-kicker mt-8 text-primary">Dish stats</h2>
            <div className="mt-4 grid grid-cols-3 border-y-2 border-foreground text-center text-xs text-muted-foreground">
              <Metric label="Status" value={s.text} />
              <Metric label="Added" value={`${days} ${t("days_ago")}`} />
              <Metric label="Comparisons" value={`${d.comparisons_count ?? 0}`} />
            </div>
            {triedCount > 0 && (
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                {t("tried_by")} {triedCount} {t("diners")}
              </p>
            )}

            {authed && isTried && otherTried && <InlineTriedCompare dish={d} other={otherTried} />}

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
                <Link to="/auth">
                  <Button>{t("sign_in")} to mark tried</Button>
                </Link>
              )}
              <Link to="/compare" search={{ dish: id } as any}>
                <Button variant="outline">{t("compare_this")}</Button>
              </Link>
              <ShareButton
                url={shareUrl}
                title={name}
                text={`${d.place?.name ?? ""}${d.price_thb != null ? ` / THB ${Number(d.price_thb).toFixed(0)}` : ""} / ${s.text}`}
                label={t("share") || "Share"}
              />
              {d.place && (
                <a href={mapsDirectionsUrl(d.place)} target="_blank" rel="noreferrer">
                  <Button variant="outline" type="button">
                    Directions
                  </Button>
                </a>
              )}
              {authed && <ReportDialog dishId={id} />}
            </div>
          </div>
          <aside className="border-t-2 border-foreground p-5 md:border-t-0 md:p-8">
            {d.submitted_by && (
              <div className="border-y border-foreground/25 py-4">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Submitted by
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
                      <p className="text-sm font-semibold">Posted by {submitterName}</p>
                      <p className="text-xs text-muted-foreground">
                        Follow to see what they eat next.
                      </p>
                    </div>
                  </Link>
                  {authed && userId !== d.submitted_by ? (
                    <Button
                      variant={isFollowingSubmitter ? "secondary" : "outline"}
                      size="sm"
                      onClick={() =>
                        followMut.mutate({
                          targetId: d.submitted_by,
                          follow: !isFollowingSubmitter,
                        })
                      }
                      disabled={followMut.isPending}
                    >
                      {isFollowingSubmitter ? "Following" : "Follow"}
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </aside>
        </div>
      </article>
    </AppShell>
  );
}

function dKey(dish: any) {
  return dish ? [dish.id, dish.category?.slug, dish.subtype_id].join(":") : "none";
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
  const { t } = useI18n();
  const [reason, setReason] = useState("wrong_info");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: () => submitReport({ data: { dishId, reason, note: note || undefined } }),
    onSuccess: () => {
      toast.success("Thanks. We'll review this.");
      setOpen(false);
      setNote("");
    },
    onError: (e: any) => toast.error(e.message),
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
              <SelectItem value="wrong_info">Wrong info</SelectItem>
              <SelectItem value="duplicate">Duplicate</SelectItem>
              <SelectItem value="place_closed">Place closed</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Optional details"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            Submit report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
