import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Camera, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  listDishSubtypes,
  getPublicTaxonomy,
  searchPlaces,
  searchSimilar,
  submitDish,
  toggleTried,
} from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";
import {
  PHOTO_ACCEPT_ATTR,
  buildPhotoPath,
  storagePathFromPhotoUrl,
  validatePhotoFile,
} from "@/lib/photo-upload";
import { useAuthUser } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/submit")({
  loader: () => getPublicTaxonomy(),
  head: () => ({
    meta: [
      { title: "Add a dish — JaanNee" },
      {
        name: "description",
        content: "Add an individual Bangkok dish for moderation and future diner comparisons.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: Submit,
});

const submitTaxonomyQuery = queryOptions({
  queryKey: ["public-taxonomy"],
  queryFn: () => getPublicTaxonomy(),
  staleTime: 10 * 60_000,
});

type PlaceRow = {
  id: string;
  name: string;
  area_id: string;
  address?: string | null;
  area?: { name_en?: string | null; name_th?: string | null } | null;
};

type CategoryRow = {
  id: string;
  slug: string;
  name_en: string;
  name_th?: string | null;
  requires_subtype?: boolean | null;
};

type SubtypeRow = {
  id: string;
  name_en: string;
  name_th?: string | null;
};

type DuplicateDish = {
  id: string;
  name_en?: string | null;
  name_th?: string | null;
  photo_url?: string | null;
  place?: { name?: string | null } | null;
};

type DuplicateResult = {
  places: PlaceRow[];
  dishes: DuplicateDish[];
};

function Submit() {
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const navigate = useNavigate();
  const auth = useAuthUser();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const loadedTaxonomy = Route.useLoaderData();
  const taxonomy = useQuery({
    ...submitTaxonomyQuery,
    initialData: loadedTaxonomy,
  });
  const categories = { data: taxonomy.data?.categories ?? [] };
  const areas = { data: taxonomy.data?.areas ?? [] };

  const [step, setStep] = useState<"form" | "duplicates" | "done">("form");
  const [dishTerm, setDishTerm] = useState("");
  const [dishFocused, setDishFocused] = useState(false);
  const [placeTerm, setPlaceTerm] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceRow | null>(null);
  const [addingPlace, setAddingPlace] = useState(false);
  const [areaId, setAreaId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subtypeId, setSubtypeId] = useState("");
  const [price, setPrice] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postedDishId, setPostedDishId] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateResult | null>(null);

  const subtypes = useQuery({
    queryKey: ["dish-subtypes", categoryId],
    queryFn: () => listDishSubtypes({ data: { categoryId } }),
    enabled: Boolean(categoryId),
  });
  const activeSubtypes = (subtypes.data ?? []) as SubtypeRow[];
  const selectedCategory = (categories.data ?? []).find(
    (category: CategoryRow) => category.id === categoryId,
  ) as CategoryRow | undefined;
  const categoryScoped = Boolean(selectedCategory?.requires_subtype) || activeSubtypes.length > 0;
  const categoryIncomplete =
    Boolean(selectedCategory?.requires_subtype) && activeSubtypes.length === 0;
  const categorySuggestions = useMemo(() => {
    const term = dishTerm.trim().toLocaleLowerCase();
    if (!term) return [];
    return (categories.data ?? [])
      .filter((category: CategoryRow) =>
        [category.name_en, category.name_th]
          .filter(Boolean)
          .some((name) => String(name).toLocaleLowerCase().includes(term)),
      )
      .slice(0, 6) as CategoryRow[];
  }, [categories.data, dishTerm]);

  const placeMatches = useQuery({
    queryKey: ["place-search", placeTerm],
    queryFn: () => searchPlaces({ data: { term: placeTerm } }),
    enabled: placeTerm.trim().length >= 2 && !selectedPlace && !addingPlace,
  });

  const selectCategory = (categoryOrId: CategoryRow | string) => {
    const category =
      typeof categoryOrId === "string"
        ? ((categories.data ?? []).find(
            (item: CategoryRow) => item.id === categoryOrId,
          ) as CategoryRow | undefined)
        : categoryOrId;
    if (!category) return;
    setCategoryId(category.id);
    setDishTerm(localizedName(category, lang));
    setSubtypeId("");
    setDishFocused(false);
  };

  const updateDishTerm = (value: string) => {
    setDishTerm(value);
    setSubtypeId("");
    const normalized = value.trim().toLocaleLowerCase();
    const exact = (categories.data ?? []).find(
      (category: CategoryRow) =>
        category.name_en.toLocaleLowerCase() === normalized ||
        category.name_th?.toLocaleLowerCase() === normalized,
    ) as CategoryRow | undefined;
    setCategoryId(exact?.id ?? "");
  };

  const selectPlace = (place: PlaceRow) => {
    setSelectedPlace(place);
    setPlaceTerm(place.name);
    setAreaId(place.area_id);
    setAddingPlace(false);
  };

  const chooseNewPlace = () => {
    setSelectedPlace(null);
    setAddingPlace(true);
  };

  const validate = (): string | null => {
    if (!dishTerm.trim()) return t("submit_required");
    if (categoryIncomplete) {
      return copy(
        "This category is not ready because it has no active dish types.",
        "หมวดนี้ยังไม่พร้อม เพราะยังไม่มีประเภทจานที่ใช้งานอยู่",
      );
    }
    if (categoryScoped && !subtypeId) {
      return copy("Choose a dish type.", "เลือกประเภทจาน");
    }
    if (!selectedPlace && (!placeTerm.trim() || !areaId)) return t("submit_required");
    if (!photoUrl) return copy("Add a dish photo first.", "เพิ่มรูปจานก่อน");
    return null;
  };

  const reviewBeforeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      const result = await searchSimilar({
        data: {
          placeName: selectedPlace?.name ?? placeTerm.trim(),
          dishName: dishTerm.trim(),
        },
      });
      const duplicateResult: DuplicateResult = {
        places: (result.places ?? []) as PlaceRow[],
        dishes: (result.dishes ?? []) as DuplicateDish[],
      };
      if (duplicateResult.places.length + duplicateResult.dishes.length > 0) {
        setDuplicates(duplicateResult);
        setStep("duplicates");
      } else {
        await sendDish();
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const sendDish = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitDish({
        data: {
          name_en:
            selectedCategory?.name_en ?? (lang === "en" ? dishTerm.trim() : undefined),
          name_th:
            selectedCategory?.name_th ?? (lang === "th" ? dishTerm.trim() : undefined),
          place_id: selectedPlace?.id,
          place_name: selectedPlace ? undefined : placeTerm.trim(),
          area_id: selectedPlace?.area_id || areaId,
          category_id: categoryId || undefined,
          requested_category_en:
            categoryId || lang === "th" ? undefined : dishTerm.trim(),
          requested_category_th:
            !categoryId && lang === "th" ? dishTerm.trim() : undefined,
          subtype_id: subtypeId || undefined,
          price_thb: price ? Number(price) : undefined,
          photo_url: photoUrl,
        },
      });
      setPostedDishId(result.id);
      setStep("done");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onFile = async (file: File) => {
    if (auth.status !== "in" || !auth.userId) {
      navigate({ to: "/auth", search: { redirect: "/submit" } });
      return;
    }
    setUploading(true);
    try {
      validatePhotoFile(file);
      const path = buildPhotoPath(auth.userId, file);
      const { error } = await supabase.storage
        .from("dish-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      const replacedPath = storagePathFromPhotoUrl(photoUrl);
      setPhotoUrl(`/photos/${path}`);
      if (replacedPath && replacedPath.startsWith(`${auth.userId}/`)) {
        const { error: cleanupError } = await supabase.storage
          .from("dish-photos")
          .remove([replacedPath]);
        if (cleanupError) console.error("Failed to remove replaced pending photo", cleanupError);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setStep("form");
    setDishTerm("");
    setDishFocused(false);
    setPlaceTerm("");
    setSelectedPlace(null);
    setAddingPlace(false);
    setAreaId("");
    setCategoryId("");
    setSubtypeId("");
    setPrice("");
    setPhotoUrl("");
    setPostedDishId(null);
    setDuplicates(null);
  };

  if (auth.status === "loading") {
    return (
      <AppShell>
        <p className="py-10 text-sm text-muted-foreground">{t("loading")}</p>
      </AppShell>
    );
  }

  if (auth.status === "out") {
    return (
      <AppShell>
        <section className="mx-auto mt-10 max-w-lg rounded-lg border border-border bg-card p-6">
          <h1 className="type-page-title">{t("nav_submit")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {copy(
              "Sign in to upload and submit a dish for moderation.",
              "เข้าสู่ระบบเพื่ออัปโหลดและส่งจานให้ผู้ดูแลตรวจสอบ",
            )}
          </p>
          <Link to="/auth" search={{ redirect: "/submit" }}>
            <Button className="mt-5 min-h-11">{t("sign_in")}</Button>
          </Link>
        </section>
      </AppShell>
    );
  }

  if (step === "done") {
    return (
      <AppShell>
        <SubmitProgress current={3} />
        <section className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8 text-center">
          <p className="font-display text-7xl text-primary">OK</p>
          <h1 className="type-page-title mt-4">{t("submit_done_title")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {copy(
              "Your post is live now. JaanNee will review its category and ranking eligibility afterward.",
              "โพสต์ของคุณเผยแพร่แล้ว JaanNee จะตรวจสอบหมวดและสิทธิ์ในการจัดอันดับภายหลัง",
            )}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {postedDishId ? (
              <Button
                onClick={() =>
                  navigate({ to: "/dish/$id", params: { id: postedDishId } })
                }
              >
                {copy("View your post", "ดูโพสต์ของคุณ")}
              </Button>
            ) : null}
            <Button variant="outline" onClick={reset}>
              {t("add_another")}
            </Button>
          </div>
        </section>
      </AppShell>
    );
  }

  if (step === "duplicates" && duplicates) {
    return (
      <AppShell>
        <SubmitProgress current={2} />
        <section className="mx-auto max-w-2xl">
          <p className="editorial-kicker text-primary">
            {copy("Possible duplicate", "อาจมีรายการซ้ำ")}
          </p>
          <h1 className="type-page-title mt-3">{t("duplicate_title")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("duplicate_body")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {duplicates.dishes.map((dish) => (
              <DuplicateDishCard key={dish.id} dish={dish} />
            ))}
            {duplicates.places.map((place) => (
              <article key={place.id} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary">
                  {copy("Existing place", "ร้านที่มีอยู่แล้ว")}
                </p>
                <h2 className="mt-2 font-semibold">{place.name}</h2>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 min-h-11"
                  onClick={() => {
                    selectPlace(place);
                    setStep("form");
                  }}
                >
                  {copy("Use this place", "ใช้ร้านนี้")}
                </Button>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setStep("form")}>
              {t("back_to_edit")}
            </Button>
            <Button onClick={sendDish} disabled={submitting}>
              {t("submit_anyway")}
            </Button>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!photoUrl) {
    return (
      <AppShell>
        <SubmitProgress current={1} />
        <section className="mx-auto max-w-xl text-center">
          <p className="editorial-kicker text-primary">{t("nav_submit")}</p>
          <h1 className="type-page-title mt-3">{copy("Start with the dish", "เริ่มจากรูปจาน")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {copy(
              "Choose a clear photo. Place, category, dish type and name come next.",
              "เลือกรูปที่ชัดเจน จากนั้นใส่ร้าน หมวด ประเภทจาน และชื่อจาน",
            )}
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-8 flex min-h-[24rem] w-full flex-col items-center justify-center border-2 border-dashed border-foreground/30 bg-card p-8 transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Camera className="h-12 w-12 text-primary" aria-hidden="true" />
            <span className="type-section-title mt-5">
              {uploading ? copy("Uploading…", "กำลังอัปโหลด…") : copy("Choose photo", "เลือกรูป")}
            </span>
          </button>
          <PhotoInput fileRef={fileRef} onFile={onFile} />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SubmitProgress current={2} />
      <div className="mx-auto max-w-xl overflow-hidden rounded-lg border border-border bg-card">
        <div className="relative aspect-[4/5] bg-muted">
          <img
            src={photoUrl}
            alt=""
            width={900}
            height={1125}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute right-3 top-3 min-h-11 bg-background/90 px-4 text-xs font-bold shadow"
          >
            {copy("Change photo", "เปลี่ยนรูป")}
          </button>
        </div>

        <form onSubmit={reviewBeforeSubmit} className="space-y-5 p-4 md:p-6">
          <div>
            <p className="editorial-kicker text-primary">{t("nav_submit")}</p>
            <h1 className="type-page-title mt-2">{copy("Post this dish", "ส่งจานนี้")}</h1>
          </div>

          <section>
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {copy("Place", "ร้าน")} *
            </Label>
            {selectedPlace ? (
              <div className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-secondary p-3 text-sm">
                <span>
                  <strong>{selectedPlace.name}</strong>
                  {selectedPlace.area ? ` · ${localizedName(selectedPlace.area, lang)}` : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedPlace(null);
                    setPlaceTerm("");
                  }}
                >
                  {t("change_category").replace(
                    lang === "th" ? "หมวด" : "category",
                    lang === "th" ? "ร้าน" : "place",
                  )}
                </Button>
              </div>
            ) : (
              <div className="mt-2">
                <Input
                  value={placeTerm}
                  onChange={(event) => {
                    setPlaceTerm(event.target.value);
                    setAddingPlace(false);
                  }}
                  placeholder={copy("Search restaurant or stall", "ค้นหาร้านหรือแผง")}
                  maxLength={160}
                  className="h-12 text-base"
                />
                {placeTerm.trim().length >= 2 && !addingPlace ? (
                  <div className="mt-2 rounded-lg border border-border bg-background p-2">
                    {(placeMatches.data ?? []).map((place: PlaceRow) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => selectPlace(place)}
                        className="block min-h-11 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <span className="font-semibold">{place.name}</span>
                        {place.area ? (
                          <span className="ml-2 text-muted-foreground">
                            {localizedName(place.area, lang)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={chooseNewPlace}
                      className="min-h-11 w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-secondary"
                    >
                      {t("add_new_place")}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            {addingPlace && !selectedPlace ? (
              <div className="mt-3">
                <Label>{t("choose_area")} *</Label>
                <Select value={areaId} onValueChange={setAreaId}>
                  <SelectTrigger className="mt-2 min-h-11">
                    <SelectValue placeholder={t("choose_area")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(areas.data ?? []).map(
                      (area: { id: string; name_en?: string; name_th?: string }) => (
                        <SelectItem key={area.id} value={area.id}>
                          {localizedName(area, lang)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </section>

          <section>
            <Label>{copy("Dish", "จาน")} *</Label>
            <div className="relative mt-2">
              <Input
                value={dishTerm}
                onFocus={() => setDishFocused(true)}
                onBlur={() => window.setTimeout(() => setDishFocused(false), 150)}
                onChange={(event) => updateDishTerm(event.target.value)}
                placeholder={copy("Start typing the dish", "เริ่มพิมพ์ชื่อจาน")}
                aria-label={copy("Dish or category", "จานหรือหมวด")}
                maxLength={80}
                required
                className="h-12 text-base"
              />
              {dishFocused && dishTerm.trim() ? (
                <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-background shadow-xl">
                  {categorySuggestions.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectCategory(category)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-secondary"
                    >
                      <span>
                        <strong>{localizedName(category, lang)}</strong>
                        {lang === "en" && category.name_th ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {category.name_th}
                          </span>
                        ) : null}
                      </span>
                      {categoryId === category.id ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      ) : null}
                    </button>
                  ))}
                  {!categoryId ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setDishFocused(false)}
                      className="min-h-12 w-full px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-secondary"
                    >
                      {copy(`Post “${dishTerm.trim()}”`, `โพสต์ “${dishTerm.trim()}”`)}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {copy(
                          "No match? Keep your wording and continue.",
                          "ไม่พบ? ใช้ชื่อนี้แล้วดำเนินการต่อ",
                        )}
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {categoryId
                ? copy("Existing dish category selected.", "เลือกหมวดจานที่มีอยู่แล้ว")
                : copy(
                    "If there is no match, your wording will be posted and reviewed later.",
                    "หากไม่พบ ชื่อที่คุณพิมพ์จะถูกโพสต์และตรวจสอบภายหลัง",
                  )}
            </p>
          </section>

          {categoryIncomplete ? (
            <p className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm font-medium text-primary">
              {copy(
                "This category is not ready because it has no active dish types.",
                "หมวดนี้ยังไม่พร้อม เพราะยังไม่มีประเภทจานที่ใช้งานอยู่",
              )}
            </p>
          ) : null}

          {categoryScoped && activeSubtypes.length > 0 ? (
            <section className="-mt-2">
              <Select value={subtypeId} onValueChange={setSubtypeId}>
                <SelectTrigger className="min-h-11">
                  <SelectValue placeholder={t("choose_dish_type")} />
                </SelectTrigger>
                <SelectContent>
                  {activeSubtypes.map((subtype) => (
                    <SelectItem key={subtype.id} value={subtype.id}>
                      {localizedName(subtype, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          ) : null}

          <section>
            <Label>{copy("Price (THB)", "ราคา (บาท)")}</Label>
            <div className="relative mt-2">
              <Input
                inputMode="numeric"
                type="number"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                min={0}
                max={100000}
                placeholder={t("optional")}
                className="h-12 pr-16 text-base"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted-foreground">
                THB
              </span>
            </div>
          </section>

          <Button type="submit" className="h-12 w-full" disabled={submitting || categoryIncomplete}>
            {submitting ? t("saving") : copy("Post now", "โพสต์เลย")}
          </Button>
        </form>
        <PhotoInput fileRef={fileRef} onFile={onFile} />
      </div>
    </AppShell>
  );
}

function SubmitProgress({ current }: { current: 1 | 2 | 3 }) {
  const { lang } = useI18n();
  const labels =
    lang === "th"
      ? ["รูปภาพ", "รายละเอียด", "โพสต์"]
      : ["Photo", "Dish", "Post"];

  return (
    <ol
      aria-label={lang === "th" ? "ขั้นตอนการโพสต์" : "Post progress"}
      className="mx-auto mb-6 grid max-w-xl grid-cols-3 gap-2"
    >
      {labels.map((label, index) => {
        const stepNumber = (index + 1) as 1 | 2 | 3;
        const active = stepNumber === current;
        const complete = stepNumber < current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`border-t-2 pt-2 text-center text-xs font-bold uppercase tracking-[0.1em] ${
              active || complete
                ? "border-primary text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            <span className="mr-1 text-primary">
              {complete ? <Check className="inline h-3.5 w-3.5" aria-hidden="true" /> : stepNumber}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function PhotoInput({
  fileRef,
  onFile,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => Promise<void>;
}) {
  return (
    <input
      ref={fileRef}
      type="file"
      accept={PHOTO_ACCEPT_ATTR}
      className="hidden"
      onChange={async (event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (file) await onFile(file);
        input.value = "";
      }}
    />
  );
}

function DuplicateDishCard({ dish }: { dish: DuplicateDish }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const name = localizedName(dish, lang);
  const markTried = async () => {
    setMarking(true);
    try {
      await toggleTried({ data: { dishId: dish.id, tried: true } });
      setMarked(true);
      toast.success(lang === "th" ? "ทำเครื่องหมายว่าเคยกินแล้ว" : "Marked as tried");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setMarking(false);
    }
  };
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      {dish.photo_url ? (
        <img
          src={dish.photo_url}
          alt={name}
          width={700}
          height={525}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
      ) : null}
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary">
          {lang === "th" ? "จานที่มีอยู่แล้ว" : "Existing dish"}
        </p>
        <h2 className="mt-2 font-semibold">{name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{dish.place?.name}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/dish/$id", params: { id: dish.id } })}
          >
            {lang === "th" ? "ดูจาน" : "View dish"}
          </Button>
          <Button type="button" onClick={markTried} disabled={marking || marked}>
            {marked ? t("tried_marked") : t("tried_it")}
          </Button>
        </div>
      </div>
    </article>
  );
}
