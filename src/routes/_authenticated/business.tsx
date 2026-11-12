import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Check, LockKeyhole, Plus, QrCode, ShieldCheck, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BusinessAiImport, BusinessAiTranslate } from "@/components/BusinessAiMenu";
import { BusinessBillingPanel } from "@/components/BusinessBillingPanel";
import { BusinessGrowthPanel } from "@/components/BusinessGrowthPanel";
import { BusinessSponsoredPanel } from "@/components/BusinessSponsoredPanel";
import { BusinessWorkspaceNav } from "@/components/BusinessWorkspaceNav";
import { BusinessQrStudio } from "@/components/BusinessQrStudio";
import { BusinessAudiencePanel } from "@/components/BusinessAudiencePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthUser } from "@/lib/use-auth";
import {
  createBusinessDraft, deleteBusinessMenuItem, listMyBusinesses, listMyBusinessMenu,
  setBusinessMenuPublished, submitBusinessForReview, updateBusinessDraft,
  upsertBusinessMenuItem,
} from "@/lib/business-live.functions";
import { businessMenuUrl } from "@/lib/business-entitlements";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({
    meta: [
      { title: "Manage your restaurant · JaanNee" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: BusinessWorkspace,
});

type MenuDraft = {
  itemId?: string;
  category: string;
  nameEn: string;
  nameTh: string;
  descriptionEn: string;
  descriptionTh: string;
  priceThb: number;
  available: boolean;
  sortOrder: number;
  priceReviewed: boolean;
  approvedTranslations: Partial<Record<"zh"|"ja"|"fr",{name:string;description:string}>>;
};

const emptyItem = (): MenuDraft => ({
  category: "Mains", nameEn: "", nameTh: "", descriptionEn: "",
  descriptionTh: "", priceThb: 0, available: true, sortOrder: 0,
  priceReviewed: true, approvedTranslations: {},
});

function BusinessWorkspace() {
  const { userId } = useAuthUser();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState("");
  const [newCuisine, setNewCuisine] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [menuEditing, setMenuEditing] = useState<MenuDraft | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const businesses = useQuery({
    queryKey: ["owned-businesses", userId],
    queryFn: () => listMyBusinesses(),
    enabled: Boolean(userId),
    retry: 1,
    staleTime: 30_000,
  });
  const rows = businesses.data ?? [];
  const selected = rows.find((r: any) => r.id === selectedId) ?? rows[0] ?? null;
  const businessId: string | null = selected?.id ?? null;
  const menu = useQuery({
    queryKey: ["business-menu", businessId],
    queryFn: () => listMyBusinessMenu({ data: { businessId: businessId! } }),
    enabled: Boolean(businessId),
    retry: 1,
  });
  const reload = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["owned-businesses"] }),
      qc.invalidateQueries({ queryKey: ["business-menu"] }),
    ]);
  };

  const create = useMutation({
    mutationFn: () => createBusinessDraft({
      data: { name: newName, area: newArea, cuisine: newCuisine, description: newDescription },
    }),
    onSuccess: async (result) => {
      setSelectedId(result.id);
      setNewName(""); setNewArea(""); setNewCuisine(""); setNewDescription("");
      await reload();
      toast.success("Private restaurant draft created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMenu = useMutation({
    mutationFn: (item: MenuDraft) => upsertBusinessMenuItem({ data: {
      restaurantId: businessId!,
      itemId: item.itemId,
      category: item.category,
      nameEn: item.nameEn,
      nameTh: item.nameTh,
      descriptionEn: item.descriptionEn,
      descriptionTh: item.descriptionTh,
      priceThb: item.priceThb,
      available: item.available,
      sortOrder: item.sortOrder,
      approvedTranslations: item.approvedTranslations,
    } }),
    onSuccess: async () => {
      setMenuEditing(null);
      await reload();
      toast.success("Menu item saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMenu = useMutation({
    mutationFn: (itemId: string) => deleteBusinessMenuItem({ data: { businessId: businessId!, itemId } }),
    onSuccess: async () => { await reload(); toast.success("Menu item removed"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = useMutation({
    mutationFn: () => submitBusinessForReview({ data: { businessId: businessId!, verificationNote: reviewNote } }),
    onSuccess: async () => { setReviewNote(""); await reload(); toast.success("Business sent for ownership verification"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const publish = useMutation({
    mutationFn: (value: boolean) => setBusinessMenuPublished({ data: { businessId: businessId!, publish: value } }),
    onSuccess: async (result) => { await reload(); toast.success(result.published ? "Menu published" : "Menu unpublished"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const liveUrl = origin && selected?.slug ? businessMenuUrl(origin, selected.slug) : "";
  const canPublish = selected?.review_status === "verified";
  const isPublished = Boolean(selected?.published_at);

  return <AppShell tone="noir">
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <header className="border-b border-white/10 pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">JaanNee for restaurants</p>
        <h1 className="mt-3 font-display text-4xl uppercase sm:text-6xl">Your restaurant workspace</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          Create a free draft page, manage your menu, and request ownership verification.
          One account works for both diners and businesses. No payment is required for basic menu tools.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <Link to="/restaurant" search={{ demo: false }} className="underline underline-offset-4">Claim an existing restaurant instead</Link>
          <Link to="/demo-business" search={{ screen: "home" }} className="underline underline-offset-4">
            Explore the business concept demo
          </Link>
        </div>
      </header>

      <BusinessWorkspaceNav hasRestaurant={Boolean(selected)}/>
      {businesses.isLoading ? <p className="text-sm text-muted-foreground">Loading your restaurant workspace…</p> : null}
      {businesses.isError ? <div role="alert" className="border border-primary/30 bg-secondary/30 p-6">
        <h2 className="font-semibold">Restaurant data temporarily unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The database may still be restricted by the Supabase bandwidth quota. Nothing was published or charged.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => void businesses.refetch()}>Retry connection</Button>
      </div> : null}

      {!businesses.isError ? <>
        {rows.length ? <section className="space-y-4">
          <h2 className="font-display text-3xl">Your restaurants</h2>
          <div className="flex flex-wrap gap-2">
            {rows.map((row: any) => <button type="button" key={row.id}
              onClick={() => { setSelectedId(row.id); setMenuEditing(null); }}
              aria-pressed={selected?.id === row.id}
              className={"min-h-11 border px-4 text-sm font-semibold " +
                (selected?.id === row.id ? "border-primary bg-primary/10" : "border-white/20")}>
              {row.name}
            </button>)}
          </div>
        </section> : null}

        <section id="business-overview" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-5 border border-border p-5 sm:p-7">
            <div className="flex items-center gap-3"><Store size={21} className="text-primary"/>
              <div><h2 className="font-display text-3xl">{rows.length ? "Add another restaurant" : "Create your first restaurant"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Private draft · Free plan</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Restaurant name" value={newName} onChange={setNewName}/>
              <Field label="Neighborhood / area" value={newArea} onChange={setNewArea}/>
              <Field label="Cuisine or concept" value={newCuisine} onChange={setNewCuisine}/>
            </div>
            <label className="block space-y-2"><span className="text-sm font-semibold">Description</span>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                maxLength={1000} rows={3}/>
            </label>
            <Button disabled={create.isPending || newName.trim().length < 3 || newArea.trim().length < 2 || newCuisine.trim().length < 2}
              onClick={() => create.mutate()}><Plus size={16} className="mr-2"/> Create private draft</Button>
          </div>
          <aside className="h-fit space-y-3 border border-border bg-secondary/20 p-5">
            <ShieldCheck className="text-primary" size={24}/>
            <h3 className="font-display text-2xl">Free, then verified</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              You can prepare your restaurant and its menu now. Public publication is locked until an administrator verifies your right to represent the restaurant.
            </p>
            <p className="text-xs text-muted-foreground">
              Paid AI translation, campaigns and checkout remain disabled pending billing and consent verification.
            </p>
          </aside>
        </section>

        {selected ? <>
          <section className="space-y-4 border border-border p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Restaurant details</p>
                <h2 className="mt-2 font-display text-3xl">{selected.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{selected.area_label} · {selected.cuisine}</p>
              </div>
              <span className="border border-border px-3 py-2 text-xs font-bold uppercase">{selected.review_status}</span>
            </div>
            {selected.review_note ? <p className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">
              Reviewer note: {selected.review_note}
            </p> : null}
            {selected.review_status === "draft" || selected.review_status === "rejected" ?
              <div className="space-y-3 border-t border-border pt-5">
                <h3 className="font-semibold">Request ownership verification</h3>
                <p className="text-sm text-muted-foreground">Explain your role and a way for JaanNee to confirm your authority. Do not include passwords or identity-document numbers.</p>
                <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="I own/manage this restaurant. Verify through our official business email or company website…"
                  maxLength={1000} rows={3}/>
                <Button disabled={reviewNote.trim().length < 10 || submit.isPending} onClick={() => submit.mutate()}>
                  <ShieldCheck size={16} className="mr-2"/> Submit for review
                </Button>
              </div> : selected.review_status === "submitted" ?
                <p className="border-l-2 border-amber-400 bg-secondary/30 p-3 text-sm">
                  Your ownership request is awaiting manual verification. Your menu remains private.
                </p> :
                <p className="inline-flex items-center gap-2 text-sm text-emerald-500"><Check size={18}/> Ownership verified</p>}
          </section>

          <section id="business-menu" className="space-y-5 border border-border p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Free menu builder</p>
                <h2 className="mt-2 font-display text-3xl">Your dishes</h2></div>
              <Button onClick={() => setMenuEditing(emptyItem())} variant="outline"><Plus size={16} className="mr-2"/> Add dish</Button>
            </div>
            {menu.isLoading ? <p className="text-sm text-muted-foreground">Loading menu…</p> : null}
            {menu.isError ? <p role="alert" className="text-sm text-primary">Menu unavailable; try again after the database recovers.</p> : null}
            {(menu.data ?? []).map((item: any) => <div key={item.id} className="flex flex-wrap items-center gap-3 border-t border-border py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.name_en}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.category} · ฿{item.price_thb} · {item.available ? "Visible when published" : "Unavailable"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setMenuEditing({
                itemId: item.id, category: item.category, nameEn: item.name_en, nameTh: item.name_th || "",
                descriptionEn: item.description_en || "", descriptionTh: item.description_th || "",
                priceThb: Number(item.price_thb), available: item.available, sortOrder: item.sort_order,
                priceReviewed: true, approvedTranslations: item.approved_translations || {},
              })}>Edit</Button>
              <Button size="sm" variant="outline" disabled={removeMenu.isPending}
                onClick={() => { if (window.confirm("Remove this dish from your menu?")) removeMenu.mutate(item.id); }}
                aria-label={"Remove " + item.name_en}><Trash2 size={15}/></Button>
            </div>)}
            {!menu.isLoading && !(menu.data ?? []).length ? <p className="text-sm text-muted-foreground">Your menu is empty. Add your first dish.</p> : null}

            {menuEditing ? <div id="business-menu-editor" className="scroll-mt-24 space-y-4 border-t border-border pt-5">
              <h3 className="font-display text-2xl">{menuEditing.itemId ? "Edit dish" : "New dish"}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Dish name (English)" value={menuEditing.nameEn}
                  onChange={(value) => setMenuEditing({ ...menuEditing, nameEn: value })}/>
                <Field label="Dish name (Thai)" value={menuEditing.nameTh}
                  onChange={(value) => setMenuEditing({ ...menuEditing, nameTh: value })}/>
                <Field label="Section" value={menuEditing.category}
                  onChange={(value) => setMenuEditing({ ...menuEditing, category: value })}/>
                <label className="block space-y-1"><span className="text-sm font-semibold">Price (THB)</span>
                  <Input type="number" min={0} max={100000} step={1} value={menuEditing.priceThb}
                    onChange={(e) => setMenuEditing({ ...menuEditing, priceThb: Number(e.target.value) || 0, priceReviewed: true })}/>
                </label>
              </div>
              <label className="block space-y-2"><span className="text-sm font-semibold">English description</span>
                <Textarea rows={2} maxLength={500} value={menuEditing.descriptionEn}
                  onChange={(e) => setMenuEditing({ ...menuEditing, descriptionEn: e.target.value })}/>
              </label>
              <label className="block space-y-2"><span className="text-sm font-semibold">Thai description</span>
                <Textarea rows={2} maxLength={500} value={menuEditing.descriptionTh}
                  onChange={(e) => setMenuEditing({ ...menuEditing, descriptionTh: e.target.value })}/>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={menuEditing.available}
                  onChange={(e) => setMenuEditing({ ...menuEditing, available: e.target.checked })}/> Available
              </label>
              {!menuEditing.priceReviewed ? <p role="alert" className="border-l-2 border-amber-400 p-3 text-xs leading-6">
                AI could not verify the printed price. Check and edit the price before saving.
              </p> : null}
              {businessId && menuEditing.nameEn.trim() ? <BusinessAiTranslate
                businessId={businessId}
                original={{name:menuEditing.nameEn,description:menuEditing.descriptionEn}}
                onApproveDraft={(language,draft)=>{
                  setMenuEditing((current)=>current ? language==="th"
                    ? {...current,nameTh:draft.name,descriptionTh:draft.description}
                    : {...current,approvedTranslations:{...current.approvedTranslations,[language]:draft}}
                    : current);
                }}/>:null}
              {Object.keys(menuEditing.approvedTranslations).length ?
                <p className="text-xs text-muted-foreground">
                  Approved translations: {Object.keys(menuEditing.approvedTranslations).join(", ")}. Save this dish to apply.
                </p> : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveMenu.mutate(menuEditing)}
                  disabled={saveMenu.isPending || !menuEditing.nameEn.trim() || !menuEditing.priceReviewed}>Save dish</Button>
                <Button variant="outline" onClick={() => setMenuEditing(null)}>Cancel</Button>
              </div>
            </div> : null}
          </section>

          {businessId ? <div id="business-ai"><BusinessAiImport businessId={businessId} onReview={(item)=>{
            setMenuEditing({
              category:item.category, nameEn:item.name, nameTh:"",
              descriptionEn:item.description, descriptionTh:"",
              priceThb:item.priceThb, available:true, sortOrder:menu.data?.length ?? 0,
              priceReviewed:!item.needsPriceReview, approvedTranslations:{},
            });
            window.requestAnimationFrame(()=>document.getElementById("business-menu-editor")?.scrollIntoView({behavior:"smooth",block:"start"}));
          }}/></div> : null}

          <section id="business-qr" className="space-y-4 border border-border p-5 sm:p-7">
            <div className="flex items-center gap-3"><QrCode className="text-primary" size={22}/>
              <h2 className="font-display text-3xl">Your public menu & QR</h2>
            </div>
            {!canPublish ? <p className="text-sm text-muted-foreground">
              Your permanent menu address is reserved, but public access is disabled until your business is verified.
            </p> : <>
              <p className="text-sm text-muted-foreground">
                {isPublished ? "Your menu is public. Any changes to available dishes appear on this same URL." :
                  "Your restaurant is verified. Publish when your menu is ready."}
              </p>
              <Button disabled={publish.isPending || (Boolean(menu.data) && !menu.data.length)}
                onClick={() => publish.mutate(!isPublished)}>
                {isPublished ? "Unpublish menu" : "Publish menu"}
              </Button>
              {isPublished && liveUrl ? <BusinessQrStudio
                name={selected.name}
                url={liveUrl}
                slug={selected.slug}
              /> : null}
            </>}
          </section>

          {businessId ? <div id="business-plan"><BusinessBillingPanel businessId={businessId}/></div> : null}
          {businessId ? <div id="business-audience"><BusinessAudiencePanel businessId={businessId}/></div> : null}
          {businessId ? <div id="business-growth"><BusinessGrowthPanel businessId={businessId}/></div> : null}
          {businessId ? <div id="business-ads"><BusinessSponsoredPanel businessId={businessId}/></div> : null}
        </> : null}
      </> : null}
    </div>
  </AppShell>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return <label className="block space-y-1">
    <span className="text-sm font-semibold">{label}</span>
    <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={120}/>
  </label>;
}
