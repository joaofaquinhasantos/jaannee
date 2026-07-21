import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listCategories, listAreas, listDishSubtypes, listDishes, myTriedIds, searchSimilar, searchPlaces, submitDish, toggleTried } from "@/lib/dishes.functions";
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
import { CategoryPicker } from "@/components/CategoryPicker";
import { InlineTriedCompare } from "@/components/InlineTriedCompare";

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
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
  const [addingPlace, setAddingPlace] = useState(false);
  const [area_id, setAreaId] = useState("");
  const [address, setAddress] = useState("");
  const [category_id, setCategoryId] = useState("");
  const [requestingCategory, setRequestingCategory] = useState(false);
  const [requestedCategoryEn, setRequestedCategoryEn] = useState("");
  const [requestedCategoryTh, setRequestedCategoryTh] = useState("");
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
  const placeMatches = useQuery({
    queryKey: ["place-search", place_name],
    queryFn: () => searchPlaces({ data: { term: place_name } }),
    enabled: place_name.trim().length >= 2 && !selectedPlace,
  });

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name_en || (!category_id && !requestedCategoryEn) || (!selectedPlace && (!place_name || !area_id))) {
      toast.error(t("submit_required"));
      return;
    }
    if (!requestingCategory && activeSubtypes.length > 0 && !subtype_id) {
      setSubtypeError("Choose a dish type for this category.");
      return;
    }
    setSubtypeError("");
    try {
      const res = await searchSimilar({ data: { placeName: place_name, dishName: name_en } });
      if ((res.places?.length ?? 0) + (res.dishes?.length ?? 0) > 0) {
        setDup(res);
        setStep("dup");
      } else await doSubmit();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doSubmit = async () => {
    try {
      await submitDish({
        data: {
          name_en,
          name_th: name_th || undefined,
          place_id: selectedPlace?.id,
          place_name: selectedPlace ? undefined : place_name,
          area_id: selectedPlace?.area_id || area_id,
          address: selectedPlace ? undefined : address || undefined,
          category_id,
          requested_category_en: requestingCategory ? requestedCategoryEn : undefined,
          requested_category_th: requestingCategory ? requestedCategoryTh || undefined : undefined,
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
    try {
      const { data: u, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);
      if (!u.user) throw new Error("Sign in before uploading photos");
      const path = `${u.user.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("dish-photos").upload(path, f, { upsert: false });
      if (error) throw new Error(error.message);
      setPhotoUrl(`/photos/${path}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
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
                  setSelectedPlace(null);
                  setAddingPlace(false);
                setPrice("");
                setNote("");
                setPhotoUrl("");
                setSubtypeId("");
                setSubtypeError("");
                setCategoryId("");
                setRequestingCategory(false);
                setRequestedCategoryEn("");
                setRequestedCategoryTh("");
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
            {(dup.dishes ?? []).filter((d) => d?.id).map((d) => (
              <DuplicateDishMatch key={d.id} dish={d} />
            ))}
            {(dup.places ?? []).filter((p) => p?.id).map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                <p className="text-xs font-bold uppercase text-primary">Existing place</p>
                <p className="mt-1 font-semibold">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">This place exists — your dish may be new here.</p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedPlace(p);
                    setPlaceName(p.name);
                    setAreaId(p.area_id);
                    setAddingPlace(false);
                    setStep("form");
                  }}
                >
                  Add my dish at this place
                </Button>
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
          <div>
            <Label>Category *</Label>
            {requestingCategory ? (
              <div className="space-y-2">
                <Input value={requestedCategoryEn} onChange={(e) => setRequestedCategoryEn(e.target.value)} placeholder="New category name (EN)" maxLength={80} />
                <Input value={requestedCategoryTh} onChange={(e) => setRequestedCategoryTh(e.target.value)} placeholder="New category name (TH optional)" maxLength={80} />
                <Button type="button" variant="outline" onClick={() => { setRequestingCategory(false); setRequestedCategoryEn(""); setRequestedCategoryTh(""); }}>
                  Choose existing category
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <CategoryPicker
                  categories={categories.data ?? []}
                  value={category_id}
                  lang={lang}
                  placeholder={t("choose_category")}
                  onChange={(v) => {
                    setCategoryId(v);
                    setSubtypeId("");
                    setSubtypeError("");
                  }}
                />
                <Button type="button" variant="outline" onClick={() => { setRequestingCategory(true); setCategoryId(""); setSubtypeId(""); setSubtypeError(""); }}>
                  Category not listed
                </Button>
              </div>
            )}
          </div>
          {!requestingCategory && activeSubtypes.length > 0 && (
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
            <Input
              value={place_name}
              onChange={(e) => {
                setPlaceName(e.target.value);
                setSelectedPlace(null);
                setAddingPlace(false);
              }}
              required
              maxLength={160}
            />
            {selectedPlace ? (
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {t("selected_place")}: {selectedPlace.name} / {lang === "th" ? selectedPlace.area?.name_th : selectedPlace.area?.name_en}
              </p>
            ) : place_name.trim().length >= 2 ? (
              <div className="mt-2 rounded-lg border border-border bg-background p-2">
                {(placeMatches.data ?? []).map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlace(p);
                      setPlaceName(p.name);
                      setAreaId(p.area_id);
                      setAddingPlace(false);
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="ml-2 text-muted-foreground">{lang === "th" ? p.area?.name_th : p.area?.name_en}</span>
                  </button>
                ))}
                {(placeMatches.data ?? []).length === 0 && (
                  <button type="button" onClick={() => setAddingPlace(true)} className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-secondary">
                    {t("add_new_place")}
                  </button>
                )}
              </div>
            ) : null}
          </div>
          {addingPlace && !selectedPlace && (
            <>
              <div>
                <Label>Area *</Label>
                <Select value={area_id} onValueChange={setAreaId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("choose_area")} />
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
            </>
          )}
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

function DuplicateDishMatch({ dish }: { dish: any }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [showCompare, setShowCompare] = useState(false);
  const [triedDone, setTriedDone] = useState(false);
  const tried = useQuery({
    queryKey: ["tried"],
    queryFn: () => myTriedIds(),
    enabled: showCompare,
    retry: false,
  });
  const pool = useQuery({
    queryKey: ["duplicate-ranking-pool", dish.category?.slug],
    queryFn: () => listDishes({ data: { categorySlug: dish.category?.slug } }),
    enabled: showCompare && !!dish.category?.slug,
    retry: false,
  });
  const tryMut = useMutation({
    mutationFn: () => toggleTried({ data: { dishId: dish.id, tried: true } }),
    onSuccess: () => {
      toast.success("Marked as tried");
      setTriedDone(true);
      setShowCompare(true);
      qc.invalidateQueries({ queryKey: ["tried"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const name = (lang === "th" && dish.name_th ? dish.name_th : dish.name_en) || "Dish";
  const isTried = triedDone || (tried.data ?? []).includes(dish.id);
  const otherTried = ((pool.data ?? []) as any[]).find(
    (candidate) =>
      candidate.id !== dish.id &&
      (tried.data ?? []).includes(candidate.id) &&
      (dish.subtype_id ? candidate.subtype_id === dish.subtype_id : !candidate.subtype_id),
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <p className="text-xs font-bold uppercase text-primary">Existing dish</p>
      <p className="mt-1 font-semibold">{name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{dish.place?.name}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/dish/$id" params={{ id: dish.id }}>
          <Button size="sm" variant="outline">View dish</Button>
        </Link>
        <Button size="sm" onClick={() => tryMut.mutate()} disabled={tryMut.isPending || isTried}>
          {isTried ? "Tried ✓" : t("tried_it")}
        </Button>
      </div>
      {showCompare && otherTried && <InlineTriedCompare dish={dish} other={otherTried} />}
    </div>
  );
}
