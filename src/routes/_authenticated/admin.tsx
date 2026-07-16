import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { amIAdmin, listPending, moderateDish, listReports, resolveReport, bulkImportCsv, upsertCategory, upsertArea, grantAdminSelf, listPendingPlaces, moderatePlace } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({ component: Admin });

function Admin() {
  const qc = useQueryClient();
  const isAdmin = useQuery({ queryKey: ["is-admin"], queryFn: () => amIAdmin() });

  if (isAdmin.isLoading) return <AppShell><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!isAdmin.data?.admin) return <AppShell><Bootstrap onGranted={() => qc.invalidateQueries({ queryKey: ["is-admin"] })} /></AppShell>;

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">Admin</h1>
      <Tabs defaultValue="pending" className="mt-6">
        <TabsList>
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

function Bootstrap({ onGranted }: { onGranted: () => void }) {
  const mut = useMutation({
    mutationFn: () => grantAdminSelf(),
    onSuccess: () => { toast.success("You are now admin"); onGranted(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center">
      <h1 className="font-display text-xl font-semibold">Admin access</h1>
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
  });
  return (
    <div className="mt-4 space-y-3">
      {(q.data ?? []).map((p: any) => (
        <div key={p.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 text-sm">
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
  });
  return (
    <div className="mt-4 space-y-3">
      {(q.data ?? []).map((d: any) => (
        <div key={d.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
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
  });
  return (
    <div className="mt-4 space-y-3">
      {(q.data ?? []).map((r: any) => (
        <div key={r.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 text-sm">
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
  const [c, setC] = useState({ slug: "", name_en: "", name_th: "" });
  const [a, setA] = useState({ slug: "", name_en: "", name_th: "" });
  const cMut = useMutation({ mutationFn: () => upsertCategory({ data: c }), onSuccess: () => { toast.success("Saved"); setC({ slug: "", name_en: "", name_th: "" }); } });
  const aMut = useMutation({ mutationFn: () => upsertArea({ data: a }), onSuccess: () => { toast.success("Saved"); setA({ slug: "", name_en: "", name_th: "" }); } });
  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-lg font-semibold">Add category</h3>
        <div className="mt-3 space-y-2">
          <div><Label>Slug</Label><Input value={c.slug} onChange={(e) => setC({ ...c, slug: e.target.value })} placeholder="pad-kra-pao" /></div>
          <div><Label>Name (EN)</Label><Input value={c.name_en} onChange={(e) => setC({ ...c, name_en: e.target.value })} /></div>
          <div><Label>Name (TH)</Label><Input value={c.name_th} onChange={(e) => setC({ ...c, name_th: e.target.value })} /></div>
          <Button onClick={() => cMut.mutate()} disabled={cMut.isPending}>Save</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-lg font-semibold">Add area</h3>
        <div className="mt-3 space-y-2">
          <div><Label>Slug</Label><Input value={a.slug} onChange={(e) => setA({ ...a, slug: e.target.value })} placeholder="sathorn" /></div>
          <div><Label>Name (EN)</Label><Input value={a.name_en} onChange={(e) => setA({ ...a, name_en: e.target.value })} /></div>
          <div><Label>Name (TH)</Label><Input value={a.name_th} onChange={(e) => setA({ ...a, name_th: e.target.value })} /></div>
          <Button onClick={() => aMut.mutate()} disabled={aMut.isPending}>Save</Button>
        </div>
      </div>
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