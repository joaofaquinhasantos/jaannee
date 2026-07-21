import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { amIAdmin, listPending, moderateDish, listReports, resolveReport, bulkImportCsv, upsertCategory, upsertArea, upsertSubtype, grantAdminSelf, listPendingPlaces, moderatePlace, listCategoriesAdmin, listAreasAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({ component: Admin });

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
          <TabsTrigger value="places">Pending places</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="taxonomy">Categories & Areas</TabsTrigger>
          <TabsTrigger value="import">Bulk import</TabsTrigger>
        </TabsList>
        <TabsContent value="pending"><PendingList /></TabsContent>
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
  const mut = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject" }) => moderatePlace({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-places"] }),
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-3">
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
    </div>
  );
}

function PendingList() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pending"], queryFn: () => listPending() });
  const mut = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject" }) => moderateDish({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending"] }),
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
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mut.mutate({ id: d.id, action: "approve" })}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: d.id, action: "reject" })}>Reject</Button>
          </div>
        </div>
      ))}
      {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Queue is empty.</p>}
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
  const qc = useQueryClient();
  const [c, setC] = useState({ slug: "", name_en: "", name_th: "" });
  const [a, setA] = useState({ slug: "", name_en: "", name_th: "" });
  const [sub, setSub] = useState({ category_id: "", slug: "", name_en: "", name_th: "", display_order: 0 });
  const cats = useQuery({ queryKey: ["admin-categories"], queryFn: () => listCategoriesAdmin() });
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: () => listAreasAdmin() });
  const [editing, setEditing] = useState<
    | { kind: "category" | "area"; slug: string; name_en: string; name_th: string }
    | null
  >(null);
  const [editingSubtype, setEditingSubtype] = useState<any | null>(null);
  const cMut = useMutation({
    mutationFn: () => upsertCategory({ data: c }),
    onSuccess: () => {
      toast.success("Saved");
      setC({ slug: "", name_en: "", name_th: "" });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const aMut = useMutation({
    mutationFn: () => upsertArea({ data: a }),
    onSuccess: () => {
      toast.success("Saved");
      setA({ slug: "", name_en: "", name_th: "" });
      qc.invalidateQueries({ queryKey: ["admin-areas"] });
      qc.invalidateQueries({ queryKey: ["areas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const subMut = useMutation({
    mutationFn: () => upsertSubtype({ data: sub }),
    onSuccess: () => {
      toast.success("Saved");
      setSub({ category_id: "", slug: "", name_en: "", name_th: "", display_order: 0 });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["dish-subtypes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const editSubMut = useMutation({
    mutationFn: () => upsertSubtype({ data: editingSubtype }),
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
      const payload = { slug: editing.slug, name_en: editing.name_en, name_th: editing.name_th };
      if (editing.kind === "category") await upsertCategory({ data: payload });
      else await upsertArea({ data: payload });
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
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-display text-3xl">Add category</h3>
        <div className="mt-3 space-y-2">
          <div>
            <Label>Slug *</Label>
            <Input value={c.slug} onChange={(e) => setC({ ...c, slug: e.target.value })} placeholder="pad-kra-pao" />
            <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, digits, hyphens only.</p>
          </div>
          <div><Label>Name (EN) *</Label><Input value={c.name_en} onChange={(e) => setC({ ...c, name_en: e.target.value })} /></div>
          <div><Label>Name (TH) *</Label><Input value={c.name_th} onChange={(e) => setC({ ...c, name_th: e.target.value })} /></div>
          <Button onClick={saveC} disabled={cMut.isPending}>Save</Button>
        </div>
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-muted-foreground">Existing categories</h4>
          <div className="mt-2 divide-y divide-border rounded-lg border border-border">
            {(cats.data ?? []).map((row: any) => (
              <div key={row.slug} className="px-3 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.name_en} <span className="text-muted-foreground">/ {row.name_th}</span></div>
                    <div className="truncate text-xs text-muted-foreground">{row.slug}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "category", slug: row.slug, name_en: row.name_en, name_th: row.name_th })}>Edit</Button>
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
            {(cats.data ?? []).length === 0 && <p className="p-3 text-xs text-muted-foreground">No categories yet.</p>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-display text-3xl">Add area</h3>
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
          <div className="mt-2 divide-y divide-border rounded-lg border border-border">
            {(areas.data ?? []).map((row: any) => (
              <div key={row.slug} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.name_en} <span className="text-muted-foreground">/ {row.name_th}</span></div>
                  <div className="truncate text-xs text-muted-foreground">{row.slug}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "area", slug: row.slug, name_en: row.name_en, name_th: row.name_th })}>Edit</Button>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editMut.isPending}>Save</Button>
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
  const [csv, setCsv] = useState("category_slug,area_slug,place_name,address,dish_name_en,dish_name_th,price_thb,photo_url,note\n");
  const [autoApprove, setAutoApprove] = useState(true);
  const mut = useMutation({
    mutationFn: () => bulkImportCsv({ data: { csv, autoApprove } }),
    onSuccess: (r: any) => { toast.success(`Imported ${r.created} dishes`); if (r.errors?.length) console.warn(r.errors); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        Columns: <code className="rounded bg-muted px-1">category_slug, area_slug, place_name, address, dish_name_en, dish_name_th, price_thb, photo_url, note</code>.
        Categories and areas must exist first.
      </p>
      <Textarea rows={12} value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
        Auto-approve imported dishes
      </label>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Importing…" : "Import"}</Button>
      {mut.data && (mut.data as any).errors?.length > 0 && (
        <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{(mut.data as any).errors.join("\n")}</pre>
      )}
    </div>
  );
}
