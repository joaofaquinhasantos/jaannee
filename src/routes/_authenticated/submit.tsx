import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listCategories, listAreas, listDishSubtypes, searchSimilar, submitDish } from "@/lib/dishes.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/submit")({ component: Submit });

function Submit() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });

  const [step, setStep] = useState<"form" | "dup" | "done">("form");
  const [name_en, setNameEn] = useState("");
  const [name_th, setNameTh] = useState("");
  const [place_name, setPlaceName] = useState("");
  const [area_id, setAreaId] = useState("");
  const [address, setAddress] = useState("");
  const [category_id, setCategoryId] = useState("");
  const [subtype_id, setSubtypeId] = useState("");
  const [subtypeError, setSubtypeError] = useState("");
  const [price_thb, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dup, setDup] = useState<{ places: any[]; dishes: any[] } | null>(null);
  const subtypes = useQuery({
    queryKey: ["dish-subtypes", category_id],
    queryFn: () => listDishSubtypes({ data: { categoryId: category_id } }),
    enabled: !!category_id,
  });
  const activeSubtypes = subtypes.data ?? [];

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name_en || !place_name || !category_id || !area_id) {
      toast.error(t("submit_required"));
      return;
    }
    if (activeSubtypes.length > 0 && !subtype_id) {
      setSubtypeError("Choose a dish type for this category.");
      return;
    }
    setSubtypeError("");
    const res = await searchSimilar({ data: { placeName: place_name, dishName: name_en } });
    if ((res.places?.length ?? 0) + (res.dishes?.length ?? 0) > 0) {
      setDup(res);
      setStep("dup");
    } else await doSubmit();
  };

  const doSubmit = async () => {
    try {
      await submitDish({
        data: {
          name_en,
          name_th: name_th || undefined,
          place_name,
          area_id,
          address: address || undefined,
          category_id,
          subtype_id: subtype_id || undefined,
          price_thb: price_thb ? Number(price_thb) : undefined,
          photo_url: photoUrl || undefined,
          note: note || undefined,
        },
      });
      setStep("done");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onFile = async (f: File) => {
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setUploading(false);
      return;
    }
    const path = `${u.user.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("dish-photos").upload(path, f, { upsert: false });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    setPhotoUrl(`/photos/${path}`);
    setUploading(false);
  };

  if (step === "done")
    return (
      <AppShell>
        <div className="mx-auto max-w-lg overflow-hidden rounded-lg border border-border bg-card">
          <div className="bg-secondary p-6 text-center">
            <span className="font-display text-7xl leading-none text-accent">OK</span>
          </div>
          <div className="p-8 text-center">
            <h1 className="font-display text-4xl leading-tight">{t("submit_done_title")}</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("submit_done_body")}</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={() => nav({ to: "/" })}>{t("back_to_feed")}</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("form");
                  setNameEn("");
                  setNameTh("");
                  setPlaceName("");
                setPrice("");
                setNote("");
                setPhotoUrl("");
                setSubtypeId("");
                setSubtypeError("");
                }}
              >
                {t("add_another")}
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    );

  if (step === "dup" && dup)
    return (
      <AppShell>
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-bold uppercase text-primary">Possible duplicate</p>
          <h1 className="mt-2 font-display text-4xl leading-tight">{t("duplicate_title")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("duplicate_body")}</p>
          <div className="mt-4 space-y-3">
            {dup.dishes.map((d) => (
              <div key={d.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                <span className="font-semibold">{d.name_en}</span> - {d.place?.name}
              </div>
            ))}
            {dup.places.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                {p.name}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep("form")}>
              {t("back_to_edit")}
            </Button>
            <Button onClick={doSubmit}>{t("submit_anyway")}</Button>
          </div>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <section className="border-b border-border pb-7">
          <p className="text-xs font-bold uppercase text-primary">Nominate a plate</p>
          <h1 className="mt-3 font-display text-5xl leading-none md:text-6xl">{t("nav_submit")}</h1>
          <p className="mt-3 max-w-xl leading-7 text-muted-foreground">
            Add the exact dish, stall, and area so it can earn a place on the board.
          </p>
        </section>

        <form onSubmit={check} className="mt-6 space-y-5 rounded-lg border border-border bg-card p-5 md:p-6">
          <div className="rounded-lg border border-dashed border-border bg-background p-4">
            <Label>Photo</Label>
            <div className="mt-2 flex items-center gap-3">
              {photoUrl && (
                <img src={photoUrl} className="h-16 w-16 rounded-lg object-cover" alt="preview" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files && onFile(e.target.files[0])}
                disabled={uploading}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Dish name (EN) *</Label>
              <Input value={name_en} onChange={(e) => setNameEn(e.target.value)} required maxLength={120} />
            </div>
            <div>
              <Label>Dish name (TH)</Label>
              <Input value={name_th} onChange={(e) => setNameTh(e.target.value)} maxLength={120} />
            </div>
          </div>
          <div>
            <Label>Category *</Label>
            <Select
              value={category_id}
              onValueChange={(v) => {
                setCategoryId(v);
                setSubtypeId("");
                setSubtypeError("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("choose_category")} />
              </SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {lang === "th" ? c.name_th : c.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {activeSubtypes.length > 0 && (
            <div>
              <Label>Dish type *</Label>
              <Select
                value={subtype_id}
                onValueChange={(v) => {
                  setSubtypeId(v);
                  setSubtypeError("");
                }}
              >
                <SelectTrigger aria-invalid={!!subtypeError}>
                  <SelectValue placeholder="Choose dish type" />
                </SelectTrigger>
                <SelectContent>
                  {activeSubtypes.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {lang === "th" ? s.name_th : s.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subtypeError && <p className="mt-1 text-sm font-medium text-primary">{subtypeError}</p>}
            </div>
          )}
          <div>
            <Label>Restaurant / stall name *</Label>
            <Input value={place_name} onChange={(e) => setPlaceName(e.target.value)} required maxLength={160} />
          </div>
          <div>
            <Label>Area *</Label>
            <Select value={area_id} onValueChange={setAreaId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose area" />
              </SelectTrigger>
              <SelectContent>
                {(areas.data ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {lang === "th" ? a.name_th : a.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Address (optional)</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
          </div>
          <div>
            <Label>Price (THB)</Label>
            <Input type="number" value={price_thb} onChange={(e) => setPrice(e.target.value)} min={0} max={100000} />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>
          <Button type="submit" className="w-full">
            {t("submit_for_review")}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
