import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDish, toggleTried, myTriedIds, submitReport } from "@/lib/dishes.functions";
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

export const Route = createFileRoute("/dish/$id")({ component: DishPage });

function DishPage() {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const dish = useQuery({ queryKey: ["dish", id], queryFn: () => getDish({ data: { id } }) });
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);
  const tried = useQuery({ queryKey: ["tried"], queryFn: () => myTriedIds(), enabled: authed });
  const isTried = (tried.data ?? []).includes(id);

  const tryMut = useMutation({
    mutationFn: () => toggleTried({ data: { dishId: id, tried: !isTried } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tried"] }); toast.success(isTried ? "Removed from tried" : "Marked as tried"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (dish.isLoading) return <AppShell><p className="text-muted-foreground">{t("loading")}</p></AppShell>;
  if (!dish.data) return <AppShell><p>Not found.</p></AppShell>;

  const d: any = dish.data;
  const name = lang === "th" && d.name_th ? d.name_th : d.name_en;
  const areaName = d.place?.area ? (lang === "th" ? d.place.area.name_th : d.place.area.name_en) : null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000));
  const s = statusLabel(d, t);

  return (
    <AppShell>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="aspect-[4/3] w-full bg-muted">
            {d.photo_url ? <img src={d.photo_url} alt={name} className="h-full w-full object-cover" /> :
              <div className="flex h-full items-center justify-center text-6xl">🍜</div>}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-primary">{lang === "th" ? d.category?.name_th : d.category?.name_en}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {d.place?.name}{areaName ? ` · ${areaName}` : ""}
          </p>
          <span className={`mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass(s.tone)}`}>{s.text}</span>
          {d.price_thb != null && <p className="mt-1 text-foreground/80">฿{Number(d.price_thb).toFixed(0)}</p>}
          {d.note && <p className="mt-4 rounded-xl bg-muted p-4 text-sm">{d.note}</p>}

          <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <div>{s.text}</div>
            <div>{t("added_ago")} {days} {t("days_ago")}</div>
            <div>{t("compared_by")} {d.comparisons_count} {t("diners")}</div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {authed ? (
              <Button variant={isTried ? "secondary" : "default"} onClick={() => tryMut.mutate()} disabled={tryMut.isPending}>
                {isTried ? t("tried_marked") : t("tried_it")}
              </Button>
            ) : (
              <Link to="/auth"><Button>{t("sign_in")} → {t("tried_it")}</Button></Link>
            )}
            <Link to="/compare" search={{ dish: id } as any}>
              <Button variant="outline">{t("compare_this")}</Button>
            </Link>
            {authed && <ReportDialog dishId={id} />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ReportDialog({ dishId }: { dishId: string }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("wrong_info");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: () => submitReport({ data: { dishId, reason, note: note || undefined } }),
    onSuccess: () => { toast.success("Thanks — we'll review this."); setOpen(false); setNote(""); },
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