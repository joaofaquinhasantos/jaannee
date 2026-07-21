import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDishComment,
  followUser,
  getDish,
  listDishComments,
  listDishes,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    const desc = `${place}${price} / ${status}`;
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
    ];
    if (ogImage) {
      meta.push({ property: "og:image", content: ogImage });
      meta.push({ name: "twitter:image", content: ogImage });
    }
    return {
      meta,
      links: origin ? [{ rel: "canonical", href: pageUrl }] : [],
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
  const [comment, setComment] = useState("");
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
  const comments = useQuery({ queryKey: ["dish-comments", id], queryFn: () => listDishComments({ data: { dishId: id } }) });
  const following = useQuery({ queryKey: ["following"], queryFn: () => myFollowingIds(), enabled: authed });
  const isTried = (tried.data ?? []).includes(id);
  const pool = useQuery({
    queryKey: ["dish-ranking-pool", dKey(dish.data)],
    queryFn: () => listDishes({ data: { categorySlug: (dish.data as any).category?.slug } }),
    enabled: authed && isTried && !!(dish.data as any)?.category?.slug,
  });

  const tryMut = useMutation({
    mutationFn: () => toggleTried({ data: { dishId: id, tried: !isTried } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tried"] });
      toast.success(isTried ? "Removed from tried" : "Marked as tried");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const commentMut = useMutation({
    mutationFn: () => addDishComment({ data: { dishId: id, body: comment } }),
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["dish-comments", id] });
      qc.invalidateQueries({ queryKey: ["activity-feed"] });
      toast.success("Comment posted");
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

  if (dish.isLoading) return <AppShell><p className="text-muted-foreground">{t("loading")}</p></AppShell>;
  if (!dish.data) return <AppShell><p>Not found.</p></AppShell>;

  const d: any = dish.data;
  const name = lang === "th" && d.name_th ? d.name_th : d.name_en;
  const secondaryName = lang === "th" && d.name_th ? d.name_en : d.name_th;
  const areaName = d.place?.area ? (lang === "th" ? d.place.area.name_th : d.place.area.name_en) : null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000));
  const s = statusLabel(d, t);
  const triedCount = d.tried_count ?? 0;
  const shareUrl = origin ? `${origin}/dish/${id}` : (typeof window !== "undefined" ? `${window.location.origin}/dish/${id}` : `/dish/${id}`);
  const otherTried = ((pool.data ?? []) as any[]).find(
    (candidate) =>
      candidate.id !== d.id &&
      (tried.data ?? []).includes(candidate.id) &&
      (d.subtype_id ? candidate.subtype_id === d.subtype_id : !candidate.subtype_id),
  );
  const submitter = d.submitter_profile;
  const submitterName = submitter?.display_name || "A JaanNee eater";
  const isFollowingSubmitter = d.submitted_by ? (following.data ?? []).includes(d.submitted_by) : false;

  return (
    <AppShell>
      <div className="grid gap-8 md:grid-cols-[1.05fr_0.95fr]">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_18px_45px_rgba(42,30,36,0.06)]">
          <div className="aspect-[4/3] w-full bg-muted">
            {d.photo_url ? (
              <img src={d.photo_url} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-secondary font-display text-5xl italic text-muted-foreground">
                JaanNee
              </div>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-primary">{lang === "th" ? d.category?.name_th : d.category?.name_en}</p>
          <h1 className="mt-3 font-display text-5xl leading-none md:text-6xl">{name}</h1>
          {secondaryName ? (
            <p className="mt-2 font-thai text-xl font-medium text-foreground/75">{secondaryName}</p>
          ) : null}
          <p className="mt-4 text-lg text-muted-foreground">
            {d.place?.name}{areaName ? ` / ${areaName}` : ""}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(s.tone)}`}>{s.text}</span>
            {d.price_thb != null && <span className="text-sm font-semibold text-foreground/80">THB {Number(d.price_thb).toFixed(0)}</span>}
          </div>
          {d.note && <p className="mt-5 rounded-lg border border-border bg-card p-4 text-sm leading-6">{d.note}</p>}

          <div className="mt-6 grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-3 text-center text-xs text-muted-foreground">
            <Metric label="Status" value={s.text} />
            <Metric label="Added" value={`${days} ${t("days_ago")}`} />
            <Metric label="Compared" value={`${d.comparisons_count} ${t("diners")}`} />
          </div>
          {triedCount > 0 && (
            <p className="mt-3 text-sm font-semibold text-muted-foreground">
              {t("tried_by")} {triedCount} {t("diners")}
            </p>
          )}

          {authed && isTried && otherTried && (
            <InlineTriedCompare dish={d} other={otherTried} />
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {authed ? (
              <Button variant={isTried ? "secondary" : "default"} onClick={() => tryMut.mutate()} disabled={tryMut.isPending}>
                {isTried ? t("tried_marked") : t("tried_it")}
              </Button>
            ) : (
              <Link to="/auth"><Button>{t("sign_in")} to mark tried</Button></Link>
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
            {authed && <ReportDialog dishId={id} />}
          </div>

          {d.submitted_by && (
            <div className="mt-6 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {submitterName.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Posted by {submitterName}</p>
                    <p className="text-xs text-muted-foreground">Follow to see what they eat next.</p>
                  </div>
                </div>
                {authed && userId !== d.submitted_by ? (
                  <Button
                    variant={isFollowingSubmitter ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => followMut.mutate({ targetId: d.submitted_by, follow: !isFollowingSubmitter })}
                    disabled={followMut.isPending}
                  >
                    {isFollowingSubmitter ? "Following" : "Follow"}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl leading-none">Comments</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tell people if it lives up to the rank.</p>
          </div>
          <ShareButton
            url={shareUrl}
            title={name}
            text={`I found ${name} at ${d.place?.name ?? "JaanNee"}.`}
            label="Share"
          />
        </div>
        <div className="mt-4 space-y-3">
          {authed ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Leave a quick take"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                className="min-h-20"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => commentMut.mutate()}
                  disabled={commentMut.isPending || comment.trim().length === 0}
                >
                  Post comment
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-md bg-secondary p-3 text-sm">
              <span>Sign in to comment, follow eaters, and save what you tried.</span>
              <Link to="/auth"><Button size="sm">{t("sign_in")}</Button></Link>
            </div>
          )}
          {(comments.data ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              No comments yet. Be the first useful opinion here.
            </p>
          ) : (
            <ul className="space-y-3">
              {(comments.data ?? []).map((item: any) => {
                const who = item.profile?.display_name || item.profile?.username || "Someone";
                return (
                  <li key={item.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{who}</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6">{item.body}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function dKey(dish: any) {
  return dish ? [dish.id, dish.category?.slug, dish.subtype_id].join(":") : "none";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase text-muted-foreground">{label}</div>
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
      <DialogTrigger asChild><Button variant="ghost">{t("report")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("report")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wrong_info">Wrong info</SelectItem>
              <SelectItem value="duplicate">Duplicate</SelectItem>
              <SelectItem value="place_closed">Place closed</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Optional details" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Submit report</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
