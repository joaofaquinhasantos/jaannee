import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { amIAdmin, listPending, listDishesAdmin, moderateDish, assignDishCategoryAdmin, createCategoryForDishAdmin, updateDishAdmin, deleteDishAdmin, mergeDishAdmin, listReports, resolveReport, bulkImportCsv, importPlacesCsv, exportDishesCsv, exportPlacesCsv, upsertCategory, upsertArea, upsertSubtype, upsertCuisine, deleteCuisine, deleteCategory, deleteArea, grantAdminSelf, listPendingPlaces, moderatePlace, listCategoriesAdmin, listAreasAdmin, listPlacesAdmin, updatePlaceCoordinatesAdmin } from "@/lib/admin.functions";
import { listCuisines, mapsDirectionsUrl } from "@/lib/dishes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cuisineLabel, groupedCategories } from "@/components/CategoryPicker";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({ component: Admin });

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Admin() {
  const qc = useQueryClient();
  const isAdmin = useQuery({ queryKey: ["is-admin"], queryFn: () => amIAdmin() });

  if (isAdmin.isLoading) return <AppShell><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!isAdmin.data?.admin) return <AppShell><Bootstrap onGranted={() => qc.invalidateQueries({ queryKey: ["is-admin"] })} /></AppShell>;

  return (
    <AppShell>
      <section className="border-b border-border pb-7">
        <p className="text-xs font-bold uppercase text-primary">Operations</p>
        <h1 className="mt-2 font-display text-5xl leading-none">Admin</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Keep the board clean: approve dishes, resolve reports, and manage the taxonomy behind the public ranking.
        </p>
      </section>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <AdminStat label="Pending dishes" value="Queue" />
        <AdminStat label="Reports" value="Review" />
        <AdminStat label="Taxonomy" value="Control" />
      </div>
      <Tabs defaultValue="pending" className="mt-6">
        <TabsList className="h-auto flex-wrap justify-start rounded-lg bg-secondary p-1">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="dishes">Dishes</TabsTrigger>
          <TabsTrigger value="places">Places</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="taxonomy">Cuisines, Categories & Areas</TabsTrigger>
          <TabsTrigger value="import">Bulk import</TabsTrigger>
        </TabsList>
        <TabsContent value="pending"><PendingList /></TabsContent>
        <TabsContent value="dishes"><DishAdmin /></TabsContent>
        <TabsContent value="places"><PendingPlaces /></TabsContent>
        <TabsContent value="reports"><Reports /></TabsContent>
        <TabsContent value="taxonomy"><Taxonomy /></TabsContent>
        <TabsContent value="import"><Import /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function AdminStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-display text-3xl leading-none text-accent">{value}</p>
      <p className="mt-2 text-xs font-bold uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function Bootstrap({ onGranted }: { onGranted: () => void }) {
  const mut = useMutation({
    mutationFn: () => grantAdminSelf(),
    onSuccess: () => { toast.success("You are now admin"); onGranted(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
      <h1 className="font-display text-4xl leading-tight">Admin access</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This account isn't an admin yet. If your email is on the server-side allowlist, you can activate admin now.
      </p>
      <Button className="mt-4" onClick={() => mut.mutate()} disabled={mut.isPending}>Activate admin</Button>
    </div>
  );
}

function PendingPlaces() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pending-places"], queryFn: () => listPendingPlaces() });
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [coordText, setCoordText] = useState("");
  const places = useQuery({ queryKey: ["admin-places", query], queryFn: () => listPlacesAdmin({ data: { query } }) });
  const exportMut = useMutation({
    mutationFn: () => exportPlacesCsv(),
    onSuccess: (csv) => downloadCsv("jaannee-places.csv", csv as string),
    onError: (e: any) => toast.error(e.message),
  });
  const mut = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject" }) => moderatePlace({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-places"] });
      qc.invalidateQueries({ queryKey: ["admin-places"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const coordMut = useMutation({
    mutationFn: (v: { id: string; lat?: number | null; lng?: number | null }) => updatePlaceCoordinatesAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Coordinates saved");
      setEditing(null);
      setCoordText("");
      qc.invalidateQueries({ queryKey: ["admin-places"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const saveCoords = () => {
    if (!editing) return;
    const parts = coordText.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 2) {
      toast.error("Paste coordinates as lat,lng");
      return;
    }
    coordMut.mutate({ id: editing.id, lat: Number(parts[0]), lng: Number(parts[1]) });
  };
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoordText(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),
      () => toast.error("Could not read your location"),
      { enableHighAccuracy: true, timeout: 7000 },
    );
  };
  return (
    <div className="mt-4 space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="font-display text-3xl">Pending places</h3>
          <p className="mt-1 text-sm text-muted-foreground">Approve new places created from the submit flow.</p>
        </div>
      {(q.data ?? []).map((p: any) => (
        <div key={p.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.area?.name_en}{p.address ? ` · ${p.address}` : ""}</div>
          </div>
          <Button size="sm" onClick={() => mut.mutate({ id: p.id, action: "approve" })}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: p.id, action: "reject" })}>Reject</Button>
        </div>
      ))}
      {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No pending places.</p>}
      </section>

      <section className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-3xl">Place coordinates</h3>
              <p className="mt-1 text-sm text-muted-foreground">Backfill lat,lng so nearby place picking works from the photo-first flow.</p>
            </div>
            <Button variant="outline" onClick={() => exportMut.mutate()} disabled={exportMut.isPending}>
              {exportMut.isPending ? "Exporting..." : "Export places"}
            </Button>
          </div>
          <Input className="mt-3 max-w-md" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search place, address, area" />
        </div>
        {(places.data ?? []).map((p: any) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                {p.area?.name_en}{p.address ? ` / ${p.address}` : ""} / {p.status}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {p.lat != null && p.lng != null ? `${p.lat}, ${p.lng}` : "No coordinates"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={mapsDirectionsUrl(p)} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" type="button">Open in Maps</Button>
              </a>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(p);
                  setCoordText(p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : "");
                }}
              >
                Coordinates
              </Button>
            </div>
          </div>
        ))}
      </section>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set place coordinates</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{editing.name}</p>
              <div>
                <Label>lat,lng</Label>
                <Input value={coordText} onChange={(e) => setCoordText(e.target.value)} placeholder="13.756331,100.501762" />
              </div>
              <Button type="button" variant="outline" onClick={useCurrentLocation}>Use my current location</Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => editing && coordMut.mutate({ id: editing.id, lat: null, lng: null })} disabled={coordMut.isPending}>Clear</Button>
            <Button onClick={saveCoords} disabled={coordMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendingList() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pending"], queryFn: () => listPending() });
  const cats = useQuery({ queryKey: ["admin-categories"], queryFn: () => listCategoriesAdmin() });
  const cuisines = useQuery({ queryKey: ["cuisines"], queryFn: () => listCuisines() });
  const [assigning, setAssigning] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<any | null>(null);
  const mut = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject" }) => moderateDish({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const assignMut = useMutation({
    mutationFn: (v: { dishId: string; categoryId: string }) => assignDishCategoryAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Category assigned");
      qc.invalidateQueries({ queryKey: ["pending"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const createMut = useMutation({
    mutationFn: () => createCategoryForDishAdmin({ data: creating }),
    onSuccess: () => {
      toast.success("Category created and assigned");
      setCreating(null);
      qc.invalidateQueries({ queryKey: ["pending"] });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-3">
      {(q.data ?? []).map((d: any) => (
        <div key={d.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
            {d.photo_url && <img src={d.photo_url} className="h-full w-full object-cover" alt="" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">{d.name_en}</div>
            <div className="text-xs text-muted-foreground">{d.place?.name} · {d.place?.area?.name_en} · {d.category?.name_en} {d.price_thb && `· ฿${d.price_thb}`}</div>
            {d.note && <div className="mt-1 text-xs italic text-muted-foreground">{d.note}</div>}
            {!d.category_id && (
              <div className="mt-3 rounded-md border border-dashed border-border bg-background p-3">
                <p className="text-xs font-bold uppercase text-primary">Requested new category</p>
                <p className="mt-1 text-sm font-medium">{d.requested_category_en}{d.requested_category_th ? ` / ${d.requested_category_th}` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Select value={assigning[d.id] ?? ""} onValueChange={(v) => setAssigning({ ...assigning, [d.id]: v })}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Assign existing category" /></SelectTrigger>
                    <SelectContent>
                      {(cats.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={!assigning[d.id] || assignMut.isPending} onClick={() => assignMut.mutate({ dishId: d.id, categoryId: assigning[d.id] })}>Assign</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCreating({
                      dishId: d.id,
                      slug: (d.requested_category_en ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                      name_en: d.requested_category_en ?? "",
                      name_th: d.requested_category_th || d.requested_category_en || "",
                      cuisine: "",
                    })}
                  >
                    Create category
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mut.mutate({ id: d.id, action: "approve" })}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: d.id, action: "reject" })}>Reject</Button>
          </div>
        </div>
      ))}
      {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Queue is empty.</p>}
      <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create category for pending dish</DialogTitle></DialogHeader>
          {creating && (
            <div className="space-y-3">
              <div><Label>Slug *</Label><Input value={creating.slug} onChange={(e) => setCreating({ ...creating, slug: e.target.value })} /></div>
              <div><Label>Name (EN) *</Label><Input value={creating.name_en} onChange={(e) => setCreating({ ...creating, name_en: e.target.value })} /></div>
              <div><Label>Name (TH) *</Label><Input value={creating.name_th} onChange={(e) => setCreating({ ...creating, name_th: e.target.value })} /></div>
              <div>
                <Label>Cuisine</Label>
                <Select value={creating.cuisine || "none"} onValueChange={(v) => setCreating({ ...creating, cuisine: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Other" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Other</SelectItem>
                    {(cuisines.data ?? []).filter((c: any) => c.slug !== "other").map((c: any) => <SelectItem key={c.slug} value={c.slug}>{c.name_en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(null)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>Create and assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DishAdmin() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [missingPhotoOnly, setMissingPhotoOnly] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<any | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingDish, setDeletingDish] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const dishes = useQuery({
    queryKey: ["admin-dishes", query, missingPhotoOnly],
    queryFn: () => listDishesAdmin({ data: { query, missingPhotoOnly } }),
  });
  const exportMut = useMutation({
    mutationFn: () => exportDishesCsv(),
    onSuccess: (csv) => downloadCsv("jaannee-dishes.csv", csv as string),
    onError: (e: any) => toast.error(e.message),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-dishes"] });
  const photoMut = useMutation({
    mutationFn: () => updateDishAdmin({ data: { id: editingPhoto.id, photo_url: photoUrl || undefined } }),
    onSuccess: () => {
      toast.success("Photo updated");
      setEditingPhoto(null);
      setPhotoUrl("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in before uploading photos");
      const path = `${userData.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("dish-photos").upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      setPhotoUrl(`/photos/${path}`);
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };
  const deleteMut = useMutation({
    mutationFn: () => deleteDishAdmin({ data: { id: deletingDish.id } }),
    onSuccess: () => {
      toast.success("Dish deleted");
      setDeletingDish(null);
      invalidate();
      qc.invalidateQueries({ queryKey: ["pending"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mergeMut = useMutation({
    mutationFn: () => mergeDishAdmin({ data: { keepId: mergeTargetId, removeId: mergeSource.id } }),
    onSuccess: () => {
      toast.success("Dish merged");
      setMergeSource(null);
      setMergeTargetId("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-display text-3xl">Dishes</h3>
        <p className="mt-1 text-sm text-muted-foreground">Add photos later, delete bad entries, or merge duplicates into the dish you want to keep.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="max-w-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dish, place, category" />
          <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <input type="checkbox" checked={missingPhotoOnly} onChange={(e) => setMissingPhotoOnly(e.target.checked)} />
            Missing photo only
          </label>
          <Button variant="outline" onClick={() => exportMut.mutate()} disabled={exportMut.isPending}>
            {exportMut.isPending ? "Exporting..." : "Export dishes"}
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {(dishes.data ?? []).map((d: any) => (
          <div key={d.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              {d.photo_url ? <img src={d.photo_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No photo</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{d.name_en}</div>
              <div className="text-xs text-muted-foreground">
                {d.place?.name} / {d.place?.area?.name_en} / {d.category?.name_en} / {d.status} / {d.comparisons_count ?? 0} comparisons
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{d.id}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditingPhoto(d); setPhotoUrl(d.photo_url ?? ""); }}>Photo</Button>
              <Button size="sm" variant="outline" onClick={() => { setMergeSource(d); setMergeTargetId(""); }}>Merge</Button>
              <Button size="sm" variant="outline" onClick={() => setDeletingDish(d)}>Delete</Button>
            </div>
          </div>
        ))}
        {dishes.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!dishes.isLoading && (dishes.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No dishes found.</p>}
      </div>
      <Dialog open={!!editingPhoto} onOpenChange={(o) => !o && setEditingPhoto(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update photo</DialogTitle></DialogHeader>
          {editingPhoto && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{editingPhoto.name_en}</p>
              <div>
                <Label>Photo URL or /photos/ path</Label>
                <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="/photos/dish.jpg" />
              </div>
              <div>
                <Label>Upload from device</Label>
                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploadingPhoto}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPhoto(file);
                  }}
                  className="file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">Choose a local image, then save the uploaded photo path.</p>
              </div>
              {photoUrl && (
                <img src={photoUrl} className="h-28 w-28 rounded-lg object-cover" alt="Preview" />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPhoto(null)}>Cancel</Button>
            <Button onClick={() => photoMut.mutate()} disabled={photoMut.isPending || uploadingPhoto}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deletingDish} onOpenChange={(o) => !o && setDeletingDish(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete dish</DialogTitle></DialogHeader>
          {deletingDish && <p className="text-sm">Delete <span className="font-semibold">{deletingDish.name_en}</span>? Tries, comparisons, and reports for this dish are removed by the database cascade.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDish(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!mergeSource} onOpenChange={(o) => !o && setMergeSource(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Merge duplicate dish</DialogTitle></DialogHeader>
          {mergeSource && (
            <div className="space-y-3">
              <p className="text-sm">Remove <span className="font-semibold">{mergeSource.name_en}</span> and keep another dish.</p>
              <div>
                <Label>Keep dish</Label>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger><SelectValue placeholder="Choose dish to keep" /></SelectTrigger>
                  <SelectContent>
                    {(dishes.data ?? []).filter((d: any) => d.id !== mergeSource.id).map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name_en} / {d.place?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Tried marks and reports move to the kept dish. Comparisons involving the removed duplicate are deleted so Elo is not silently rewritten.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeSource(null)}>Cancel</Button>
            <Button onClick={() => mergeMut.mutate()} disabled={mergeMut.isPending || !mergeTargetId}>Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Reports() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["reports"], queryFn: () => listReports() });
  const mut = useMutation({
    mutationFn: (v: { id: string; status: "resolved" | "dismissed" }) => resolveReport({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-3">
      {(q.data ?? []).map((r: any) => (
        <div key={r.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{r.dish?.name_en} <span className="text-xs text-muted-foreground">({r.dish?.place?.name})</span></div>
            <div className="text-xs text-muted-foreground">{r.reason}{r.note ? ` — ${r.note}` : ""}</div>
          </div>
          <Button size="sm" onClick={() => mut.mutate({ id: r.id, status: "resolved" })}>Resolve</Button>
          <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: r.id, status: "dismissed" })}>Dismiss</Button>
        </div>
      ))}
      {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No open reports.</p>}
    </div>
  );
}

function Taxonomy() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [c, setC] = useState({ slug: "", name_en: "", name_th: "", cuisine: "" });
  const [cu, setCu] = useState({ slug: "", name_en: "", name_th: "" });
  const [a, setA] = useState({ slug: "", name_en: "", name_th: "" });
  const [catFilter, setCatFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [sub, setSub] = useState({ category_id: "", slug: "", name_en: "", name_th: "", display_order: 0 });
  const cats = useQuery({ queryKey: ["admin-categories"], queryFn: () => listCategoriesAdmin() });
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: () => listAreasAdmin() });
  const cuisines = useQuery({ queryKey: ["cuisines"], queryFn: () => listCuisines() });
  const [editing, setEditing] = useState<
    | { kind: "category" | "area"; slug: string; name_en: string; name_th: string; cuisine?: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState<
    | { kind: "category" | "area"; id: string; name_en: string; slug: string }
    | { kind: "cuisine"; name_en: string; slug: string }
    | null
  >(null);
  const [editingSubtype, setEditingSubtype] = useState<any | null>(null);
  const requireOk = (result: any) => {
    if (!result?.ok) throw new Error(result?.error?.message ?? result?.error ?? "Save failed");
    return result;
  };
  const cMut = useMutation({
    mutationFn: async () => requireOk(await upsertCategory({ data: c })),
    onSuccess: () => {
      toast.success("Saved");
      setC({ slug: "", name_en: "", name_th: "", cuisine: "" });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const aMut = useMutation({
    mutationFn: async () => requireOk(await upsertArea({ data: a })),
    onSuccess: () => {
      toast.success("Saved");
      setA({ slug: "", name_en: "", name_th: "" });
      qc.invalidateQueries({ queryKey: ["admin-areas"] });
      qc.invalidateQueries({ queryKey: ["areas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const subMut = useMutation({
    mutationFn: async () => requireOk(await upsertSubtype({ data: sub })),
    onSuccess: () => {
      toast.success("Saved");
      setSub({ category_id: "", slug: "", name_en: "", name_th: "", display_order: 0 });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["dish-subtypes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const cuMut = useMutation({
    mutationFn: async () => requireOk(await upsertCuisine({ data: cu })),
    onSuccess: () => {
      toast.success("Saved");
      setCu({ slug: "", name_en: "", name_th: "" });
      qc.invalidateQueries({ queryKey: ["cuisines"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const editSubMut = useMutation({
    mutationFn: async () => requireOk(await upsertSubtype({ data: editingSubtype })),
    onSuccess: () => {
      toast.success("Updated");
      setEditingSubtype(null);
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["dish-subtypes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const editMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload = { slug: editing.slug, name_en: editing.name_en, name_th: editing.name_th, cuisine: editing.cuisine };
      if (editing.kind === "category") requireOk(await upsertCategory({ data: payload }));
      else requireOk(await upsertArea({ data: payload }));
    },
    onSuccess: () => {
      toast.success("Updated");
      if (editing?.kind === "category") {
        qc.invalidateQueries({ queryKey: ["admin-categories"] });
        qc.invalidateQueries({ queryKey: ["categories"] });
      } else {
        qc.invalidateQueries({ queryKey: ["admin-areas"] });
        qc.invalidateQueries({ queryKey: ["areas"] });
      }
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!deleting) return;
      if (deleting.kind === "category") requireOk(await deleteCategory({ data: { id: deleting.id } }));
      else if (deleting.kind === "area") requireOk(await deleteArea({ data: { id: deleting.id } }));
      else requireOk(await deleteCuisine({ data: { slug: deleting.slug } }));
    },
    onSuccess: () => {
      toast.success("Deleted");
      if (deleting?.kind === "category") {
        qc.invalidateQueries({ queryKey: ["admin-categories"] });
        qc.invalidateQueries({ queryKey: ["categories"] });
      } else if (deleting?.kind === "area") {
        qc.invalidateQueries({ queryKey: ["admin-areas"] });
        qc.invalidateQueries({ queryKey: ["areas"] });
      } else {
        qc.invalidateQueries({ queryKey: ["cuisines"] });
        qc.invalidateQueries({ queryKey: ["categories"] });
        qc.invalidateQueries({ queryKey: ["admin-categories"] });
      }
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const SLUG_RE = /^[a-z0-9-]+$/;
  const validate = (v: { slug: string; name_en: string; name_th: string }) => {
    const slug = v.slug.trim();
    const en = v.name_en.trim();
    const th = v.name_th.trim();
    if (!slug || !en || !th) return "All fields are required";
    if (!SLUG_RE.test(slug)) return "Slug: lowercase letters, digits, hyphens only";
    return null;
  };
  const saveC = () => { const err = validate(c); if (err) { toast.error(err); return; } cMut.mutate(); };
  const saveCu = () => { const err = validate(cu); if (err) { toast.error(err); return; } cuMut.mutate(); };
  const saveA = () => { const err = validate(a); if (err) { toast.error(err); return; } aMut.mutate(); };
  const saveSub = () => {
    const err = validate(sub);
    if (!sub.category_id) { toast.error("Choose a category"); return; }
    if (err) { toast.error(err); return; }
    subMut.mutate();
  };
  const saveEdit = () => {
    if (!editing) return;
    if (!editing.name_en.trim() || !editing.name_th.trim()) { toast.error("Both names are required"); return; }
    editMut.mutate();
  };
  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-4 md:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl">Cuisines</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add cuisine groups here, then assign categories to them below.</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <div>
            <Label>Slug *</Label>
            <Input value={cu.slug} onChange={(e) => setCu({ ...cu, slug: e.target.value })} placeholder="korean" />
          </div>
          <div><Label>Name (EN) *</Label><Input value={cu.name_en} onChange={(e) => setCu({ ...cu, name_en: e.target.value })} /></div>
          <div><Label>Name (TH) *</Label><Input value={cu.name_th} onChange={(e) => setCu({ ...cu, name_th: e.target.value })} /></div>
          <Button onClick={saveCu} disabled={cuMut.isPending}>Save</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(cuisines.data ?? []).map((row: any) => (
            <div key={row.slug} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <span className="font-medium">{row.name_en}</span>
              <span className="text-xs text-muted-foreground">{row.slug}</span>
              <Button size="sm" variant="outline" onClick={() => setDeleting({ kind: "cuisine", name_en: row.name_en, slug: row.slug })}>Delete</Button>
            </div>
          ))}
          {(cuisines.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No cuisines yet.</p>}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-display text-3xl">Categories</h3>
        <p className="mt-1 text-sm text-muted-foreground">Add categories, choose their cuisine group, or delete unused ones.</p>
        <div className="mt-3 space-y-2">
          <div>
            <Label>Slug *</Label>
            <Input value={c.slug} onChange={(e) => setC({ ...c, slug: e.target.value })} placeholder="pad-kra-pao" />
            <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, digits, hyphens only.</p>
          </div>
          <div><Label>Name (EN) *</Label><Input value={c.name_en} onChange={(e) => setC({ ...c, name_en: e.target.value })} /></div>
          <div><Label>Name (TH) *</Label><Input value={c.name_th} onChange={(e) => setC({ ...c, name_th: e.target.value })} /></div>
          <div>
            <Label>{t("cuisine")}</Label>
            <Select value={c.cuisine || "none"} onValueChange={(v) => setC({ ...c, cuisine: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Other" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("cuisine_other")}</SelectItem>
                {(cuisines.data ?? []).filter((item: any) => item.slug !== "other").map((item: any) => (
                  <SelectItem key={item.slug} value={item.slug}>{item.name_en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveC} disabled={cMut.isPending}>Save</Button>
        </div>
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-muted-foreground">Existing categories</h4>
          <Input className="mt-2" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} placeholder={t("filter_categories")} />
          <div className="mt-2 divide-y divide-border rounded-lg border border-border">
            {groupedCategories(cats.data ?? [], catFilter).map(([cuisine, rows]) => (
              <div key={cuisine} className="px-3 py-3 text-sm">
                <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{cuisineLabel(cuisine, t)}</p>
                {rows.map((row: any) => (
              <div key={row.slug} className="border-t border-border py-3 first:border-t-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.name_en} <span className="text-muted-foreground">/ {row.name_th}</span></div>
                    <div className="truncate text-xs text-muted-foreground">{row.slug}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "category", slug: row.slug, name_en: row.name_en, name_th: row.name_th, cuisine: row.cuisine || "" })}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleting({ kind: "category", id: row.id, name_en: row.name_en, slug: row.slug })}>Delete</Button>
                  </div>
                </div>
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Dish types</p>
                    <Button size="sm" variant="outline" onClick={() => setSub({ category_id: row.id, slug: "", name_en: "", name_th: "", display_order: 0 })}>Add type</Button>
                  </div>
                  {(row.subtypes ?? [])
                    .sort((x: any, y: any) => (x.display_order ?? 0) - (y.display_order ?? 0) || x.name_en.localeCompare(y.name_en))
                    .map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{s.name_en} <span className="text-muted-foreground">/ {s.name_th}</span></div>
                          <div className="truncate text-xs text-muted-foreground">{s.slug} / {s.is_active ? "active" : "inactive"}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setEditingSubtype({ ...s, category_id: row.id })}>Edit</Button>
                      </div>
                    ))}
                  {(row.subtypes ?? []).length === 0 && <p className="text-xs text-muted-foreground">No dish types for this category.</p>}
                </div>
              </div>
                ))}
              </div>
            ))}
            {(cats.data ?? []).length === 0 && <p className="p-3 text-xs text-muted-foreground">No categories yet.</p>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-display text-3xl">Areas</h3>
        <p className="mt-1 text-sm text-muted-foreground">Add areas or delete unused ones.</p>
        <div className="mt-3 space-y-2">
          <div>
            <Label>Slug *</Label>
            <Input value={a.slug} onChange={(e) => setA({ ...a, slug: e.target.value })} placeholder="sathorn" />
            <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, digits, hyphens only.</p>
          </div>
          <div><Label>Name (EN) *</Label><Input value={a.name_en} onChange={(e) => setA({ ...a, name_en: e.target.value })} /></div>
          <div><Label>Name (TH) *</Label><Input value={a.name_th} onChange={(e) => setA({ ...a, name_th: e.target.value })} /></div>
          <Button onClick={saveA} disabled={aMut.isPending}>Save</Button>
        </div>
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-muted-foreground">Existing areas</h4>
          <Input className="mt-2" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} placeholder={t("filter_areas")} />
          <div className="mt-2 divide-y divide-border rounded-lg border border-border">
            {(areas.data ?? [])
              .filter((row: any) => [row.name_en, row.name_th, row.slug].some((v) => String(v).toLowerCase().includes(areaFilter.toLowerCase())))
              .map((row: any) => (
              <div key={row.slug} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.name_en} <span className="text-muted-foreground">/ {row.name_th}</span></div>
                  <div className="truncate text-xs text-muted-foreground">{row.slug}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "area", slug: row.slug, name_en: row.name_en, name_th: row.name_th })}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleting({ kind: "area", id: row.id, name_en: row.name_en, slug: row.slug })}>Delete</Button>
                </div>
              </div>
            ))}
            {(areas.data ?? []).length === 0 && <p className="p-3 text-xs text-muted-foreground">No areas yet.</p>}
          </div>
        </div>
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.kind === "category" ? "category" : "area"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Slug</Label>
                <Input value={editing.slug} readOnly disabled />
                <p className="mt-1 text-xs text-muted-foreground">Slug is read-only.</p>
              </div>
              <div>
                <Label>Name (EN) *</Label>
                <Input value={editing.name_en} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} />
              </div>
              <div>
                <Label>Name (TH) *</Label>
                <Input value={editing.name_th} onChange={(e) => setEditing({ ...editing, name_th: e.target.value })} />
              </div>
              {editing.kind === "category" && (
                <div>
                  <Label>{t("cuisine")}</Label>
                  <Select value={editing.cuisine || "none"} onValueChange={(v) => setEditing({ ...editing, cuisine: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Other" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("cuisine_other")}</SelectItem>
                      {(cuisines.data ?? []).filter((item: any) => item.slug !== "other").map((item: any) => (
                        <SelectItem key={item.slug} value={item.slug}>{item.name_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.kind}</DialogTitle>
          </DialogHeader>
          {deleting && (
            <div className="space-y-2 text-sm">
              <p>
                Delete <span className="font-semibold">{deleting.name_en}</span>?
              </p>
              <p className="text-muted-foreground">
                This only works when nothing uses it. Cuisines with categories, categories with dishes, and areas with places are blocked.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!sub.category_id} onOpenChange={(o) => !o && setSub({ category_id: "", slug: "", name_en: "", name_th: "", display_order: 0 })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add dish type</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Slug *</Label><Input value={sub.slug} onChange={(e) => setSub({ ...sub, slug: e.target.value })} placeholder="tiramisu" /></div>
            <div><Label>Name (EN) *</Label><Input value={sub.name_en} onChange={(e) => setSub({ ...sub, name_en: e.target.value })} /></div>
            <div><Label>Name (TH) *</Label><Input value={sub.name_th} onChange={(e) => setSub({ ...sub, name_th: e.target.value })} /></div>
            <div><Label>Display order</Label><Input type="number" value={sub.display_order} onChange={(e) => setSub({ ...sub, display_order: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSub({ category_id: "", slug: "", name_en: "", name_th: "", display_order: 0 })}>Cancel</Button>
            <Button onClick={saveSub} disabled={subMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingSubtype} onOpenChange={(o) => !o && setEditingSubtype(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit dish type</DialogTitle></DialogHeader>
          {editingSubtype && (
            <div className="space-y-3">
              <div><Label>Slug</Label><Input value={editingSubtype.slug} readOnly disabled /></div>
              <div><Label>Name (EN) *</Label><Input value={editingSubtype.name_en} onChange={(e) => setEditingSubtype({ ...editingSubtype, name_en: e.target.value })} /></div>
              <div><Label>Name (TH) *</Label><Input value={editingSubtype.name_th} onChange={(e) => setEditingSubtype({ ...editingSubtype, name_th: e.target.value })} /></div>
              <div><Label>Display order</Label><Input type="number" value={editingSubtype.display_order ?? 0} onChange={(e) => setEditingSubtype({ ...editingSubtype, display_order: Number(e.target.value) })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editingSubtype.is_active} onChange={(e) => setEditingSubtype({ ...editingSubtype, is_active: e.target.checked })} />
                Active
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubtype(null)}>Cancel</Button>
            <Button onClick={() => editSubMut.mutate()} disabled={editSubMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Import() {
  const [csv, setCsv] = useState("category_slug,subtype_slug,area_slug,place_name,address,lat,lng,dish_name_en,dish_name_th,price_thb,photo_url,note\n");
  const [placesCsv, setPlacesCsv] = useState("name,area_slug,address,lat,lng\n");
  const [autoApprove, setAutoApprove] = useState(true);
  const readCsvFile = (file: File | undefined, onText: (text: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result ?? "").replace(/^\uFEFF/, ""));
    reader.onerror = () => toast.error("Could not read CSV file");
    reader.readAsText(file);
  };
  const mut = useMutation({
    mutationFn: () => bulkImportCsv({ data: { csv, autoApprove } }),
    onSuccess: (r: any) => toast.success(`Dishes: ${r.created} created, ${r.skipped ?? 0} skipped, ${r.failed ?? r.errors?.length ?? 0} failed`),
    onError: (e: any) => toast.error(e.message),
  });
  const placesMut = useMutation({
    mutationFn: () => importPlacesCsv({ data: { csv: placesCsv, autoApprove } }),
    onSuccess: (r: any) => toast.success(`Places: ${r.created} created, ${r.skipped ?? 0} skipped, ${r.failed ?? r.errors?.length ?? 0} failed`),
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-6">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
        Auto-approve imported rows
      </label>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-display text-3xl">Import dishes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Columns: <code className="rounded bg-muted px-1">category_slug, subtype_slug, area_slug, place_name, address, lat, lng, dish_name_en, dish_name_th, price_thb, photo_url, note</code>.
            Extra export columns are ignored.
          </p>
        </div>
        <div>
          <Label>Choose CSV file</Label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => readCsvFile(e.target.files?.[0], setCsv)}
            className="file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground"
          />
        </div>
        <Textarea rows={12} value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs" />
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Importing..." : "Import dishes"}</Button>
        <ImportResult result={mut.data} />
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-display text-3xl">Import places</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Columns: <code className="rounded bg-muted px-1">name, area_slug, address, lat, lng</code>. Extra export columns are ignored.
          </p>
        </div>
        <div>
          <Label>Choose CSV file</Label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => readCsvFile(e.target.files?.[0], setPlacesCsv)}
            className="file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground"
          />
        </div>
        <Textarea rows={10} value={placesCsv} onChange={(e) => setPlacesCsv(e.target.value)} className="font-mono text-xs" />
        <Button onClick={() => placesMut.mutate()} disabled={placesMut.isPending}>{placesMut.isPending ? "Importing..." : "Import places"}</Button>
        <ImportResult result={placesMut.data} />
      </section>
    </div>
  );
}

function ImportResult({ result }: { result: any }) {
  if (!result) return null;
  const lines = [
    `Created: ${result.created ?? 0}`,
    `Skipped: ${result.skipped ?? 0}`,
    `Failed: ${result.failed ?? result.errors?.length ?? 0}`,
    ...((result.skips ?? []) as any[]).map((s) => `Row ${s.row}: ${s.reason}`),
    ...((result.errors ?? []) as any[]).map((e) => `Row ${e.row}: ${e.reason}`),
  ];
  return <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{lines.join("\n")}</pre>;
}
