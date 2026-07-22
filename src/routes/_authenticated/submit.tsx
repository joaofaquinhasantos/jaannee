import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listCategories, listAreas, listDishSubtypes, listDishes, listNearbyPlaces, myTriedIds, searchSimilar, searchPlaces, submitDish, toggleTried } from "@/lib/dishes.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { CategoryPicker } from "@/components/CategoryPicker";
import { InlineTriedCompare } from "@/components/InlineTriedCompare";

export const Route = createFileRoute("/_authenticated/submit")({ component: Submit });

const PRICE_CHIPS = ["60", "80", "100", "120", "150"];

function Submit() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
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
  const [customPrice, setCustomPrice] = useState(false);
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dup, setDup] = useState<{ places: any[]; dishes: any[] } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied" | "ready">("idle");

  const subtypes = useQuery({
    queryKey: ["dish-subtypes", category_id],
    queryFn: () => listDishSubtypes({ data: { categoryId: category_id } }),
    enabled: !!category_id,
  });
  const activeSubtypes = subtypes.data ?? [];
  const nearby = useQuery({
    queryKey: ["nearby-places", geo?.lat, geo?.lng],
    queryFn: () => listNearbyPlaces({ data: geo! }),
    enabled: !!geo,
  });
  const placeMatches = useQuery({
    queryKey: ["place-search", place_name],
    queryFn: () => searchPlaces({ data: { term: place_name } }),
    enabled: step === "form" && place_name.trim().length >= 2 && !selectedPlace,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session?.user);
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!photoUrl || geoState !== "idle" || typeof navigator === "undefined" || !navigator.geolocation) return;
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("ready");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 300000 },
    );
  }, [photoUrl, geoState]);

  const selectCategory = (value: string, category: any) => {
    setCategoryId(value);
    setSubtypeId("");
    setSubtypeError("");
    if (!name_en.trim()) setNameEn(category.name_en ?? "");
    if (lang === "th" && !name_th.trim()) setNameTh(category.name_th ?? "");
  };

  const selectPlace = (place: any) => {
    setSelectedPlace(place);
    setPlaceName(place.name);
    setAreaId(place.area_id);
    setAddingPlace(false);
  };

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
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sign in to post this dish");
        nav({ to: "/auth" });
        return;
      }
      await submitDish({
        data: {
          name_en,
          name_th: name_th || undefined,
          place_id: selectedPlace?.id,
          place_name: selectedPlace ? undefined : place_name,
          area_id: selectedPlace?.area_id || area_id,
          address: selectedPlace ? undefined : address || undefined,
          category_id: category_id || undefined,
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

  const resetForm = () => {
    setStep("form");
    setNameEn("");
    setNameTh("");
    setPlaceName("");
    setSelectedPlace(null);
    setAddingPlace(false);
    setAreaId("");
    setAddress("");
    setPrice("");
    setCustomPrice(false);
    setNote("");
    setPhotoUrl("");
    setSubtypeId("");
    setSubtypeError("");
    setCategoryId("");
    setRequestingCategory(false);
    setRequestedCategoryEn("");
    setRequestedCategoryTh("");
    setGeo(null);
    setGeoState("idle");
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
              <Button variant="outline" onClick={resetForm}>{t("add_another")}</Button>
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
            {(dup.dishes ?? []).filter((d) => d?.id).map((d) => <DuplicateDishMatch key={d.id} dish={d} />)}
            {(dup.places ?? []).filter((p) => p?.id).map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                <p className="text-xs font-bold uppercase text-primary">Existing place</p>
                <p className="mt-1 font-semibold">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">This place exists - your dish may be new here.</p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => { selectPlace(p); setStep("form"); }}>
                  Add my dish at this place
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep("form")}>{t("back_to_edit")}</Button>
            <Button onClick={doSubmit}>{t("submit_anyway")}</Button>
          </div>
        </div>
      </AppShell>
    );

  if (!authChecked) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[60dvh] max-w-xl items-center justify-center">
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </AppShell>
    );
  }

  if (!authed) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl">
          <div className="flex min-h-[70dvh] w-full flex-col items-center justify-center rounded-lg border border-border bg-card px-6 text-center">
            <Camera className="h-12 w-12 text-primary" />
            <h1 className="mt-5 font-display text-5xl leading-none">Sign in to post a dish</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Dishes are added by signed-in diners so the board stays useful and rankable.
            </p>
            <Button className="mt-6" onClick={() => nav({ to: "/auth", search: { redirect: "/submit" } as any })}>
              Sign in
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!photoUrl) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex min-h-[70dvh] w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center transition-colors hover:bg-secondary"
          >
            <Camera className="h-12 w-12 text-primary" />
            <span className="mt-5 font-display text-5xl leading-none">Add a photo</span>
            <span className="mt-2 text-sm font-semibold text-foreground/75">Photo first, details after</span>
            <span className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
              Start with the dish. Camera or gallery, then four taps to submit.
            </span>
            <span className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">
              Choose photo
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative aspect-[4/5] bg-muted">
            <img src={photoUrl} className="h-full w-full object-cover" alt="Dish preview" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute right-3 top-3 rounded-full bg-background/90 px-3 py-1.5 text-xs font-bold shadow"
            >
              Change
            </button>
          </div>
          <form onSubmit={check} className="space-y-5 rounded-t-2xl bg-card p-4 shadow-[0_-18px_45px_rgba(42,30,36,0.08)]">
            <div>
              <p className="text-xs font-bold uppercase text-primary">Add to JaanNee</p>
              <h1 className="mt-1 font-display text-4xl leading-none">Post this dish</h1>
            </div>

            <section>
              <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Place *</Label>
              {geoState === "asking" && <p className="mt-2 text-sm text-muted-foreground">Checking nearby places...</p>}
              {(nearby.data ?? []).length > 0 && !selectedPlace && (
                <div className="mt-2">
                  <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">You're near:</p>
                  <div className="grid gap-2">
                    {(nearby.data ?? []).map((p: any) => (
                      <button key={p.id} type="button" onClick={() => selectPlace(p)} className="rounded-md border border-border px-3 py-3 text-left text-sm hover:bg-secondary">
                        <span className="block font-semibold">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(p.distance_m)}m / {lang === "th" ? p.area?.name_th : p.area?.name_en}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedPlace ? (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-border bg-secondary p-3 text-sm">
                  <span><strong>{selectedPlace.name}</strong> / {lang === "th" ? selectedPlace.area?.name_th : selectedPlace.area?.name_en}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPlace(null)}>Change</Button>
                </div>
              ) : (
                <div className="mt-3">
                  <Input value={place_name} onChange={(e) => { setPlaceName(e.target.value); setSelectedPlace(null); setAddingPlace(false); }} maxLength={160} placeholder="Search place or stall" className="h-12 text-base" />
                  {place_name.trim().length >= 2 && (
                    <div className="mt-2 rounded-lg border border-border bg-background p-2">
                      {(placeMatches.data ?? []).map((p: any) => (
                        <button key={p.id} type="button" onClick={() => selectPlace(p)} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary">
                          <span className="font-semibold">{p.name}</span>
                          <span className="ml-2 text-muted-foreground">{lang === "th" ? p.area?.name_th : p.area?.name_en}</span>
                        </button>
                      ))}
                      <button type="button" onClick={() => { setAddingPlace(true); setDetailsOpen(true); }} className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-secondary">
                        {t("add_new_place")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section>
              <Label>Category *</Label>
              {requestingCategory ? (
                <div className="mt-2 space-y-2">
                  <Input value={requestedCategoryEn} onChange={(e) => { setRequestedCategoryEn(e.target.value); if (!name_en.trim()) setNameEn(e.target.value); }} placeholder="New category name (EN)" maxLength={80} />
                  <Input value={requestedCategoryTh} onChange={(e) => { setRequestedCategoryTh(e.target.value); if (lang === "th" && !name_th.trim()) setNameTh(e.target.value); }} placeholder="New category name (TH optional)" maxLength={80} />
                  <Button type="button" variant="outline" onClick={() => { setRequestingCategory(false); setRequestedCategoryEn(""); setRequestedCategoryTh(""); }}>Choose existing category</Button>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <CategoryPicker categories={categories.data ?? []} value={category_id} lang={lang} placeholder={t("choose_category")} onChange={selectCategory} />
                  <Button type="button" variant="outline" onClick={() => { setRequestingCategory(true); setCategoryId(""); setSubtypeId(""); setSubtypeError(""); }}>Category not listed</Button>
                </div>
              )}
            </section>

            <section>
              <Label>Dish name *</Label>
              <Input value={name_en} onChange={(e) => setNameEn(e.target.value)} placeholder="Autofills from category" required maxLength={120} className="mt-2 h-12 text-base" />
            </section>

            {!requestingCategory && activeSubtypes.length > 0 && (
              <section>
                <Label>Dish type *</Label>
                <Select value={subtype_id} onValueChange={(v) => { setSubtypeId(v); setSubtypeError(""); }}>
                  <SelectTrigger aria-invalid={!!subtypeError} className="mt-2"><SelectValue placeholder="Choose dish type" /></SelectTrigger>
                  <SelectContent>
                    {activeSubtypes.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{lang === "th" ? s.name_th : s.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subtypeError && <p className="mt-1 text-sm font-medium text-primary">{subtypeError}</p>}
              </section>
            )}

            <section>
              <Label>Price (THB)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                <PriceChip active={!price_thb && !customPrice} onClick={() => { setPrice(""); setCustomPrice(false); }}>Skip</PriceChip>
                {PRICE_CHIPS.map((p) => <PriceChip key={p} active={price_thb === p && !customPrice} onClick={() => { setPrice(p); setCustomPrice(false); }}>{p}</PriceChip>)}
                <PriceChip active={customPrice} onClick={() => setCustomPrice(true)}>Custom</PriceChip>
              </div>
              {customPrice && <Input inputMode="numeric" type="number" value={price_thb} onChange={(e) => setPrice(e.target.value)} min={0} max={100000} placeholder="THB" className="mt-2 h-12 text-base" />}
            </section>

            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  More details
                  <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4">
                <div><Label>Dish name (TH)</Label><Input value={name_th} onChange={(e) => setNameTh(e.target.value)} maxLength={120} /></div>
                {addingPlace && !selectedPlace && (
                  <>
                    <div>
                      <Label>Area *</Label>
                      <Select value={area_id} onValueChange={setAreaId}>
                        <SelectTrigger><SelectValue placeholder={t("choose_area")} /></SelectTrigger>
                        <SelectContent>
                          {(areas.data ?? []).map((a: any) => <SelectItem key={a.id} value={a.id}>{lang === "th" ? a.name_th : a.name_en}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Address (optional)</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} /></div>
                  </>
                )}
                <div><Label>Note (optional)</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></div>
              </CollapsibleContent>
            </Collapsible>

            <Button type="submit" className="h-12 w-full">Submit</Button>
          </form>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
    </AppShell>
  );
}

function PriceChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-4 py-2 text-sm font-bold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function DuplicateDishMatch({ dish }: { dish: any }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [triedDone, setTriedDone] = useState(false);
  const [tryingDish, setTryingDish] = useState(false);
  const [otherTried, setOtherTried] = useState<any | null>(null);
  const handleTried = async () => {
    setTryingDish(true);
    try {
      await toggleTried({ data: { dishId: dish.id, tried: true } });
      toast.success("Marked as tried");
      setTriedDone(true);
      if (dish.category?.slug) {
        try {
          const [triedIds, pool] = await Promise.all([myTriedIds(), listDishes({ data: { categorySlug: dish.category.slug } })]);
          const other = ((pool ?? []) as any[]).find(
            (candidate) => candidate.id !== dish.id && (triedIds ?? []).includes(candidate.id) && (dish.subtype_id ? candidate.subtype_id === dish.subtype_id : !candidate.subtype_id),
          );
          setOtherTried(other ?? null);
        } catch {
          setOtherTried(null);
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTryingDish(false);
    }
  };
  const name = (lang === "th" && dish.name_th ? dish.name_th : dish.name_en) || "Dish";

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <p className="text-xs font-bold uppercase text-primary">Existing dish</p>
      <p className="mt-1 font-semibold">{name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{dish.place?.name}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => nav({ to: "/dish/$id", params: { id: dish.id } })}>View dish</Button>
        <Button size="sm" onClick={handleTried} disabled={tryingDish || triedDone}>{triedDone ? "Tried" : t("tried_it")}</Button>
      </div>
      {otherTried && <InlineTriedCompare dish={dish} other={otherTried} />}
    </div>
  );
}
