import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { amIAdmin, listPending, listDishesAdmin, moderateDish, assignDishCategoryAdmin, createCategoryForDishAdmin, updateDishAdmin, deleteDishAdmin, mergeDishAdmin, listReports, resolveReport, bulkImportCsv, importPlacesCsv, exportDishesCsv, exportPlacesCsv, upsertCategory, upsertArea, upsertSubtype, upsertCuisine, deleteCuisine, deleteCategory, deleteArea, grantAdminSelf, listPendingPlaces, moderatePlace, listCategoriesAdmin, listAreasAdmin, listPlacesAdmin, updatePlaceAdmin } from "@/lib/admin.functions";
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
import { ChevronRight } from "lucide-react";
import { PHOTO_ACCEPT_ATTR, buildPhotoPath, validatePhotoFile } from "@/lib/photo-upload";

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

  if (isAdmin.isLoading) return <AppShell><p className="text-muted-foreground">Loadingâ€¦</p></AppShell>;
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
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: () => listAreasAdmin() });
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [placeForm, setPlaceForm] = useState({ name: "", areaId: "", address: "", status: "pending", coordText: "" });
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
  const placeMut = useMutation({
    mutationFn: (v: { id: string; name: string; areaId: string; address?: string; status: "approved" | "pending" | "rejected"; lat?: number | null; lng?: number | null }) =>
      updatePlaceAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Place saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["pending-places"] });
      qc.invalidateQueries({ queryKey: ["admin-places"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const parseCoordText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return { lat: null, lng: null };
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 2) throw new Error("Paste coordinates as lat,lng");
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("Latitude must be between -90 and 90");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("Longitude must be between -180 and 180");
    return { lat, lng };
  };
  const openPlaceEditor = (p: any) => {
    setEditing(p);
    setPlaceForm({
      name: p.name ?? "",
      areaId: p.area?.id ?? "",
      address: p.address ?? "",
      status: p.status ?? "pending",
      coordText: p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : "",
    });
  };
  const savePlace = () => {
    if (!editing) return;
    try {
      const coords = parseCoordText(placeForm.coordText);
      placeMut.mutate({
        id: editing.id,
        name: placeForm.name,
        areaId: placeForm.areaId,
        address: placeForm.address || undefined,
        status: placeForm.status as "approved" | "pending" | "rejected",
        ...coords,
      });
    } catch (e: any) {
      toast.error(e.message);
      return;
    }
  };
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPlaceForm((v) => ({ ...v, coordText: `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}` })),
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
            <div className="text-xs text-muted-foreground">{p.area?.name_en}{p.address ? ` Â· ${p.address}` : ""}</div>
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
                onClick={() => openPlaceEditor(p)}
              >
                Edit
              </Button>
            </div>
          </div>
        ))}
      </section>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit place</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={placeForm.name} onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Area</Label>
                <Select value={placeForm.areaId} onValueChange={(v) => setPlaceForm({ ...placeForm, areaId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose area" /></SelectTrigger>
                  <SelectContent>
                    {(areas.data ?? []).map((area: any) => (
                      <SelectItem key={area.id} value={area.id}>{area.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Address</Label>
                <Input value={placeForm.address} onChange={(e) => setPlaceForm({ ...placeForm, address: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={placeForm.status} onValueChange={(v) => setPlaceForm({ ...placeForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>lat,lng</Label>
                <Input value={placeForm.coordText} onChange={(e) => setPlaceForm({ ...placeForm, coordText: e.target.value })} placeholder="13.756331,100.501762" />
              </div>
              <Button type="button" variant="outline" onClick={useCurrentLocation}>Use my current location</Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => setPlaceForm({ ...placeForm, coordText: "" })} disabled={placeMut.isPending}>Clear coords</Button>
            <Button onClick={savePlace} disabled={placeMut.isPending || !placeForm.name.trim() || !placeForm.areaId}>Save</Button>
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
  const [assigning, setAssigning] = useState<Record<string, string>>×´âÚ$z{-®éÜj×b#àÐ¢ÆƒB6Æ74æÖSÒ'FW‡B×6ÒföçB×6VÖ–&öÆBFW‡BÖ×WFVBÖf÷&Vw&÷VæB#äW†—7F–ær&V3ÂöƒCàÐ¢Ä–çWB6Æ74æÖSÒ&×BÓ""fÇVS×¶&Vf–ÇFW'Òöä6†ævS×²†R’Óâ6WD&Vf–ÇFW"†RçF&vWBçfÇVR—ÒÆ6V†öÆFW#×·B‚&f–ÇFW%ö&V2"—ÒóàÐ¢ÆF—b6Æ74æÖSÒ&×BÓ"F—f–FR×’F—f–FRÖ&÷&FW"&÷VæFVBÖÆr&÷&FW"&÷&FW"Ö&÷&FW"#àÐ¢²†&V2æFFóòµÒÐ¢æf–ÇFW"‚‡&÷s¢ç’’Óâ·&÷rææÖUöVâÂ&÷rææÖU÷F‚Â&÷rç6ÇVuÒç6öÖR‚‡b’Óâ7G&–ær‡b’çFôÆ÷vW$66R‚’æ–æ6ÇVFW2†&Vf–ÇFW"çFôÆ÷vW$66R‚’’’Ð¢æÖ‚‡&÷s¢ç’’Óâ€Ð¢ÆF—b¶W“×·&÷rç6ÇVwÒ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâvÓ2‚Ó2’Ó"FW‡B×6Ò#àÐ¢ÆF—b6Æ74æÖSÒ&Ö–â×rÓ#àÐ¢ÆF—b6Æ74æÖSÒ'G'Væ6FRföçBÖÖVF—VÒ#ç·&÷rææÖUöVçÒÇ7â6Æ74æÖSÒ'FW‡BÖ×WFVBÖf÷&Vw&÷VæB#âò·&÷rææÖU÷F‡ÓÂ÷7ããÂöF—càÐ¢ÆF—b6Æ74æÖSÒ'G'Væ6FRFW‡B×‡2FW‡BÖ×WFVBÖf÷&Vw&÷VæB#ç·&÷rç6ÇVwÓÂöF—càÐ¢ÂöF—càÐ¢ÆF—b6Æ74æÖSÒ&fÆW‚6‡&–æ²ÓvÓ"#àÐ¢Ä'WGFöâ6—¦SÒ'6Ò"f&–çCÒ&÷WFÆ–æR"öä6Æ–6³×²‚’Óâ6WDVF—F–ær‡²¶–æC¢&&V"Â6ÇVs¢&÷rç6ÇVrÂæÖUöVã¢&÷rææÖUöVâÂæÖU÷Fƒ¢&÷rææÖU÷F‚Ò—ÓäVF—CÂô'WGFöãàÐ¢Ä'WGFöâ6—¦SÒ'6Ò"f&–çCÒ&÷WFÆ–æR"öä6Æ–6³×²‚’Óâ6WDFVÆWF–ær‡²¶–æC¢&&V"Â–C¢&÷ræ–BÂæÖUöVã¢&÷rææÖUöVâÂ6ÇVs¢&÷rç6ÇVrÒ—ÓäFVÆWFSÂô'WGFöãàÐ¢ÂöF—càÐ¢ÂöF—càÐ¢’—ÐÐ¢²†&V2æFFóòµÒ’æÆVæwF‚ÓÓÒbbÇ6Æ74æÖSÒ'Ó2FW‡B×‡2FW‡BÖ×WFVBÖf÷&Vw&÷VæB#äæò&V2–WBãÂ÷çÐÐ¢ÂöF—càÐ¢ÂöF—càÐ¢ÂöF—càÐ¢ÄF–Æör÷Vã×²VF—F–æwÒöä÷Vä6†ævS×²†ò’Óâòbb6WDVF—F–ær†çVÆÂ—ÓàÐ¢ÄF–Æöt6öçFVçCàÐ¢ÄF–Æöt†VFW#àÐ¢ÄF–ÆöuF—FÆSäVF—B¶VF—F–æsòæ¶–æBÓÓÒ&6FVv÷'’"ò&6FVv÷'’"¢&&V'ÓÂôF–ÆöuF—FÆSàÐ¢ÂôF–Æöt†VFW#àÐ¢¶VF—F–ærbb€Ð¢ÆF—b6Æ74æÖSÒ'76R×’Ó2#àÐ¢ÆF—càÐ¢ÄÆ&VÃå6ÇVsÂôÆ&VÃàÐ¢Ä–çWBfÇVS×¶VF—F–ærç6ÇVwÒ&VDöæÇ’F—6&ÆVBóàÐ¢Ç6Æ74æÖSÒ&×BÓFW‡B×‡2FW‡BÖ×WFVBÖf÷&Vw&÷VæB#å6ÇVr—2&VBÖöæÇ’ãÂ÷àÐ¢ÂöF—càÐ¢ÆF—càÐ¢ÄÆ&VÃäæÖR„Tâ’£ÂôÆ&VÃàÐ¢Ä–çWBfÇVS×¶VF—F–ærææÖUöVçÒöä6†ævS×²†R’Óâ6WDVF—F–ær‡²ââæVF—F–ærÂæÖUöVã¢RçF&vWBçfÇVRÒ—ÒóàÐ¢ÂöF—càÐ¢ÆF—càÐ¢ÄÆ&VÃäæÖR…D‚’£ÂôÆ&VÃàÐ¢Ä–çWBfÇVS×¶VF—F–ærææÖU÷F‡Òöä6†ævS×²†R’Óâ6WDVF—F–ær‡²ââæVF—F–ærÂæÖU÷Fƒ¢RçF&vWBçfÇVRÒ—ÒóàÐ¢ÂöF—càÐ¢¶VF—F–æræ¶–æBÓÓÒ&6FVv÷'’"bb€¢ÆF—cà¢ÄÆ&VÃç·B‚&7V—6–æR"—ÓÂôÆ&VÃàÐ¢Å6VÆV7BfÇVS×¶VF—F–æræ7V—6–æRÇÂ&æöæR'ÒöåfÇVT6†ævS×²‡b’Óâ6WDVF—F–ær‡²ââæVF—F–ærÂ7V—6–æS¢bÓÓÒ&æöæR"ò""¢bÒ—ÓàÐ¢Å6VÆV7EG&–vvW#ãÅ6VÆV7EfÇVRÆ6V†öÆFW#Ò$÷F†W""óãÂõ6VÆV7EG&–vvW#àÐ¢Å6VÆV7D6öçFVçCàÐ¢Å6VÆV7D—FVÒfÇVSÒ&æöæR#ç·B‚&7V—6–æUö÷F†W""—ÓÂõ6VÆV7D—FVÓàÐ¢²†7V—6–æW2æFFóòµÒ’æf–ÇFW"‚†—FVÓ¢ç’’Óâ—FVÒç6ÇVrÓÒ&÷F†W""’æÖ‚†—FVÓ¢ç’’Óâ€Ð¢Å6VÆV7D—FVÒ¶W“×¶—FVÒç6ÇVwÒfÇVS×¶—FVÒç6ÇVwÓç¶—FVÒææÖUöVçÓÂõ6VÆV7D—FVÓàÐ¢’—ÐÐ¢Âõ6VÆV7D6öçFVçCàÐ¢Âõ6VÆV7CàÐ¢ÂöF—cà¢—Ð¢¶VF—F–æræ¶–æBÓÓÒ&6FVv÷'’"bb€¢ÆF—b6Æ74æÖSÒ'&÷VæFVBÖÖB&÷&FW"&÷&FW"Ö&÷&FW"&rÖ&6¶w&÷VæBÓ2#à¢ÄÆ&VÃå&VfW&Væ6R†÷FóÂôÆ&VÃà¢Ç6Æ74æÖSÒ&×BÓFW‡B×‡2FW‡BÖ×WFVBÖf÷&Vw&÷VæB#åW6VBöæÇ’26FVv÷'’W†×ÆRÂæWfW"2&æ¶VBF—6‚ãÂ÷à¢¶VF—F–ærç&VfW&Væ6U÷†÷Fõ÷W&Âbb€¢Æ–Ör7&3×¶VF—F–ærç&VfW&Væ6U÷†÷Fõ÷W&ÇÒÇCÒ""6Æ74æÖSÒ&×BÓ"‚Ó3brÖgVÆÂ&÷VæFVBÖÖBö&¦V7BÖ6÷fW""óà¢—Ð¢ÆF—b6Æ74æÖSÒ&×BÓ"fÆW‚fÆW‚×w&—FV×2Ö6VçFW"vÓ"#à¢Ä–çW@¢G—SÒ&f–ÆR ¢66WC×µ„õDõô44UEôEE'Ð¢F—6&ÆVC×·WÆöF–æt6FVv÷'•†÷F÷Ð¢öä6†ævS×¶7–æ2†R’Óâ°¢6öç7Bf–ÆRÒRçF&vWBæf–ÆW3òå³Ó°¢–b†f–ÆR’°¢v—BWÆöD6FVv÷'•†÷Fò†f–ÆRÂ‡W&Â’Óà¢6WDVF—F–ær‚†7W'&VçB’Óà¢7W'&VçBò²ââæ7W'&VçBÂ&VfW&Væ6U÷†÷Fõ÷W&Ã¢W&ÂÒ¢7W'&VçBÀ¢’À¢“°¢Ð¢Ræ7W'&VçEF&vWBçfÇVRÒ"#°¢×Ð¢óà¢¶VF—F–ærç&VfW&Væ6U÷†÷Fõ÷W&Âbb€¢Ä'WGFöà¢G—SÒ&'WGFöâ ¢6—¦SÒ'6Ò ¢f&–çCÒ&÷WFÆ–æR ¢öä6Æ–6³×²‚’Óâ6WDVF—F–ær‡²ââæVF—F–ærÂ&VfW&Væ6U÷†÷Fõ÷W&Ã¢""Ò—Ð¢à¢&VÖ÷fP¢Âô'WGFöãà¢—Ð¢ÂöF—cà¢ÂöF—cà¢—Ð¢¶VF—F–æræ¶–æBÓÓÒ&6FVv÷'’"bb€Ð¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2×7F'BvÓ"&÷VæFVBÖÖB&÷&FW"&÷&FW"Ö&÷&FW"&rÖ&6¶w&÷VæBÓ2FW‡B×6Ò#àÐ¢Æ–çWBG—SÒ&6†V6¶&÷‚"6Æ74æÖSÒ&×BÓãR"6†V6¶VC×²VF—F–ærç&WV—&W5÷7V'G—WÒöä6†ævS×²†R’Óâ6WDVF—F–ær‡²ââæVF—F–ærÂ&WV—&W5÷7V'G—S¢RçF&vWBæ6†V6¶VBÒ—ÒóàÐ¢Ç7ãàÐ¢Ç7â6Æ74æÖSÒ&föçB×6VÖ–&öÆB#å&WV—&W2F—6‚G—SÂ÷7ãàÐ¢Ç7â6Æ74æÖSÒ&×BÓãR&Æö6²FW‡B×‡2FW‡BÖ×WFVBÖf÷&Vw&÷VæB#ä&Æö6·2&÷fÂöbF—6†W2–âF†—26FVv÷'’VçF–ÂF—6‚G—R—2–6¶VBãÂ÷7ãàÐ¢Â÷7ãàÐ¢ÂöÆ&VÃàÐ¢—ÐÐ¢¶VF—F–æræ¶–æBÓÓÒ&6FVv÷'’"bbVF—F–ærç&WV—&W5÷7V'G—Rbb‚‚’Óâ°Ð¢6öç7B6BÒ†6G2æFFóòµÒ’æf–æB‚†3¢ç’’Óâ2ç6ÇVrÓÓÒVF—F–ærç6ÇVr“°Ð¢6öç7B7F—fT6÷VçBÒ‚†6Còç7V'G—W2óòµÒ’2ç•µÒ’æf–ÇFW"‚‡3¢ç’’Óâ2æ—5ö7F—fR’æÆVæwFƒ°Ð¢–b†7F—fT6÷VçBÓÓÒ’&WGW&âçVÆÃ°Ð¢&WGW&â€Ð¢Ç6Æ74æÖSÒ'&÷VæFVBÖÖB&÷&FW"&÷&FW"Ö&÷&FW"&r×6V6öæF'’Ó"FW‡B×‡2FW‡BÖ×WFVBÖf÷&Vw&÷VæB#àÐ¢F†—26FVv÷'’v–ÆÂ&VÖ–â7V'G—R×66÷VBv†–ÆR7F—fRF—6‚G—W2W†—7BàÐ¢Â÷àÐ¢“°Ð¢Ò’‚—ÐÐ¢ÂöF—càÐ¢—ÐÐ¢ÄF–Æötfö÷FW#àÐ¢Ä'WGFöâf&–çCÒ&÷WFÆ–æR"öä6Æ–6³×²‚’Óâ6WDVF—F–ær†çVÆÂ—Óä6æ6VÃÂô'WGFöãàÐ¢Ä'WGFöâöä6Æ–6³×·6fTVF—GÒF—6&ÆVC×¶VF—D×WBæ—5VæF–æwÓå6fSÂô'WGFöãàÐ¢ÂôF–Æötfö÷FW#àÐ¢ÂôF–Æöt6öçFVçCàÐ¢ÂôF–ÆösàÐ¢ÄF–Æör÷Vã×²FVÆWF–æwÒöä÷Vä6†ævS×²†ò’Óâòbb6WDFVÆWF–ær†çVÆÂ—ÓàÐ¢ÄF–Æöt6öçFVçCàÐ¢ÄF–Æöt†VFW#àÐ¢ÄF–ÆöuF—FÆSäFVÆWFR¶FVÆWF–æsòæ¶–æGÓÂôF–ÆöuF—FÆSàÐ¢ÂôF–Æöt†VFW#àÐ¢¶FVÆWF–ærbb€Ð¢ÆF—b6Æ74æÖSÒ'76R×’Ó"FW‡B×6Ò#àÐ¢ÇàÐ¢FVÆWFRÇ7â6Æ74æÖSÒ&föçB×6VÖ–&öÆB#ç¶FVÆWF–ærææÖUöVçÓÂ÷7ããðÐ¢Â÷àÐ¢Ç6Æ74æÖSÒ'FW‡BÖ×WFVBÖf÷&Vw&÷VæB#àÐ¢F†—2öæÇ’v÷&·2v†Vâæ÷F†–ærW6W2—Bâ7V—6–æW2v—F‚6FVv÷&–W2Â6FVv÷&–W2v—F‚F—6†W2ÂæB&V2v—F‚Æ6W2&R&Æö6¶VBàÐ¢Â÷àÐ¢ÂöF—càÐ¢—ÐÐ¢ÄF–Æötfö÷FW#àÐ¢Ä'WGFöâf&–çCÒ&÷WFÆ–æR"öä6Æ–6³×²‚’Óâ6WDFVÆWF–ær†çVÆÂ—Óä6æ6VÃÂô'WGFöãàÐ¢Ä'WGFöâf&–çCÒ&FW7G'V7F—fR"öä6Æ–6³×²‚’ÓâFVÆWFT×WBæ×WFFR‚—ÒF—6&ÆVC×¶FVÆWFT×WBæ—5VæF–æwÓäFVÆWFSÂô'WGFöãàÐ¢ÂôF–Æötfö÷FW#àÐ¢ÂôF–Æöt6öçFVçCàÐ¢ÂôF–ÆösàÐ¢ÄF–Æör÷Vã×²7V"æ6FVv÷'•ö–GÒöä÷Vä6†ævS×²†ò’Óâòbb6WE7V"‡²6FVv÷'•ö–C¢""Â6ÇVs¢""ÂæÖUöVã¢""ÂæÖU÷Fƒ¢""ÂF—7Æ•ö÷&FW#¢Ò—ÓàÐ¢ÄF–Æöt6öçFVçCàÐ¢ÄF–Æöt†VFW#ãÄF–ÆöuF—FÆSäFBF—6‚G—SÂôF–ÆöuF—FÆSãÂôF–Æöt†VFW#àÐ¢ÆF—b6Æ74æÖSÒ'76R×’Ó2#àÐ¢ÆF—cãÄÆ&VÃå6ÇVr£ÂôÆ&VÃãÄ–çWBfÇVS×·7V"ç6ÇVwÒöä6†ævS×²†R’Óâ6WE7V"‡²ââç7V"Â6ÇVs¢RçF&vWBçfÇVRÒ—ÒÆ6V†öÆFW#Ò'F—&Ö—7R"óãÂöF—càÐ¢ÆF—cãÄÆ&VÃäæÖR„Tâ’£ÂôÆ&VÃãÄ–çWBfÇVS×·7V"ææÖUöVçÒöä6†ævS×²†R’Óâ6WE7V"‡²ââç7V"ÂæÖUöVã¢RçF&vWBçfÇVRÒ—ÒóãÂöF—càÐ¢ÆF—cãÄÆ&VÃäæÖR…D‚’£ÂôÆ&VÃãÄ–çWBfÇVS×·7V"ææÖU÷F‡Òöä6†ævS×²†R’Óâ6WE7V"‡²ââç7V"ÂæÖU÷Fƒ¢RçF&vWBçfÇVRÒ—ÒóãÂöF—càÐ¢ÆF—cãÄÆ&VÃäF—7Æ’÷&FW#ÂôÆ&VÃãÄ–çWBG—SÒ&çVÖ&W""fÇVS×·7V"æF—7Æ•ö÷&FW'Òöä6†ævS×²†R’Óâ6WE7V"‡²ââç7V"ÂF—7Æ•ö÷&FW#¢çVÖ&W"†RçF&vWBçfÇVR’Ò—ÒóãÂöF—càÐ¢ÂöF—càÐ¢ÄF–Æötfö÷FW#àÐ¢Ä'WGFöâf&–çCÒ&÷WFÆ–æR"öä6Æ–6³×²‚’Óâ6WE7V"‡²6FVv÷'•ö–C¢""Â6ÇVs¢""ÂæÖUöVã¢""ÂæÖU÷Fƒ¢""ÂF—7Æ•ö÷&FW#¢Ò—Óä6æ6VÃÂô'WGFöãàÐ¢Ä'WGFöâöä6Æ–6³×·6fU7V'ÒF—6&ÆVC×·7V$×WBæ—5VæF–æwÓå6fSÂô'WGFöãàÐ¢ÂôF–Æötfö÷FW#àÐ¢ÂôF–Æöt6öçFVçCàÐ¢ÂôF–ÆösàÐ¢ÄF–Æör÷Vã×²VF—F–æu7V'G—WÒöä÷Vä6†ævS×²†ò’Óâòbb6WDVF—F–æu7V'G—R†çVÆÂ—ÓàÐ¢ÄF–Æöt6öçFVçCàÐ¢ÄF–Æöt†VFW#ãÄF–ÆöuF—FÆSäVF—BF—6‚G—SÂôF–ÆöuF—FÆSãÂôF–Æöt†VFW#àÐ¢¶VF—F–æu7V'G—Rbb€Ð¢ÆF—b6Æ74æÖSÒ'76R×’Ó2#àÐ¢ÆF—cãÄÆ&VÃå6ÇVsÂôÆ&VÃãÄ–çWBfÇVS×¶VF—F–æu7V'G—Rç6ÇVwÒ&VDöæÇ’F—6&ÆVBóãÂöF—càÐ¢ÆF—cãÄÆ&VÃäæÖR„Tâ’£ÂôÆ&VÃãÄ–çWBfÇVS×¶VF—F–æu7V'G—RææÖUöVçÒöä6†ævS×²†R’Óâ6WDVF—F–æu7V'G—R‡²ââæVF—F–æu7V'G—RÂæÖUöVã¢RçF&vWBçfÇVRÒ—ÒóãÂöF—càÐ¢ÆF—cãÄÆ&VÃäæÖR…D‚’£ÂôÆ&VÃãÄ–çWBfÇVS×¶VF—F–æu7V'G—RææÖU÷F‡Òöä6†ævS×²†R’Óâ6WDVF—F–æu7V'G—R‡²ââæVF—F–æu7V'G—RÂæÖU÷Fƒ¢RçF&vWBçfÇVRÒ—ÒóãÂöF—càÐ¢ÆF—cãÄÆ&VÃäF—7Æ’÷&FW#ÂôÆ&VÃãÄ–çWBG—SÒ&çVÖ&W""fÇVS×¶VF—F–æu7V'G—RæF—7Æ•ö÷&FW"óòÒöä6†ævS×²†R’Óâ6WDVF—F–æu7V'G—R‡²ââæVF—F–æu7V'G—RÂF—7Æ•ö÷&FW#¢çVÖ&W"†RçF&vWBçfÇVR’Ò—ÒóãÂöF—càÐ¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"FW‡B×6Ò#àÐ¢Æ–çWBG—SÒ&6†V6¶&÷‚"6†V6¶VC×²VF—F–æu7V'G—Ræ—5ö7F—fWÒöä6†ævS×²†R’Óâ6WDVF—F–æu7V'G—R‡²ââæVF—F–æu7V'G—RÂ—5ö7F—fS¢RçF&vWBæ6†V6¶VBÒ—ÒóàÐ¢7F—fPÐ¢ÂöÆ&VÃàÐ¢ÂöF—càÐ¢—ÐÐ¢ÄF–Æötfö÷FW#àÐ¢Ä'WGFöâf&–çCÒ&÷WFÆ–æR"öä6Æ–6³×²‚’Óâ6WDVF—F–æu7V'G—R†çVÆÂ—Óä6æ6VÃÂô'WGFöãàÐ¢Ä'WGFöâöä6Æ–6³×²‚’ÓâVF—E7V$×WBæ×WFFR‚—ÒF—6&ÆVC×¶VF—E7V$×WBæ—5VæF–æwÓå6fSÂô'WGFöãàÐ¢ÂôF–Æötfö÷FW#àÐ¢ÂôF–Æöt6öçFVçCàÐ¢ÂôF–ÆösàÐ¢ÂöF—càÐ¢“°Ð§ÐÐ Ð¦gVæ7F–öâ–×÷'B‚’°Ð¢6öç7B¶77bÂ6WD77eÒÒW6U7FFR‚&6FVv÷'•÷6ÇVrÇ7V'G—U÷6ÇVrÆ&V÷6ÇVrÇÆ6UöæÖRÆFG&W72ÆÆBÆÆærÆF—6…öæÖUöVâÆF—6…öæÖU÷F‚Ç&–6U÷F†"Ç†÷Fõ÷W&ÂÆæ÷FUÆâ"“°Ð¢6öç7B·Æ6W477bÂ6WEÆ6W477eÒÒW6U7FFR‚&æÖRÆ&V÷6ÇVrÆFG&W72ÆÆBÆÆæuÆâ"“°Ð¢6öç7B¶WFô&÷fRÂ6WDWFô&÷fUÒÒW6U7FFR‡G'VR“°Ð¢6öç7B&VD77df–ÆRÒ†f–ÆS¢f–ÆRÂVæFVf–æVBÂöåFW‡C¢‡FW‡C¢7G&–ær’Óâfö–B’Óâ°Ð¢–b‚f–ÆR’&WGW&ã°Ð¢6öç7B&VFW"ÒæWrf–ÆU&VFW"‚“°Ð¢&VFW"æöæÆöBÒ‚’ÓâöåFW‡B…7G&–ær‡&VFW"ç&W7VÇBóò""’ç&WÆ6R‚õåÇTdTdbòÂ""’“°Ð¢&VFW"æöæW'&÷"Ò‚’ÓâFö7BæW'&÷"‚$6÷VÆBæ÷B&VB55bf–ÆR"“°Ð¢&VFW"ç&VD5FW‡B†f–ÆR“°Ð¢Ó°Ð¢6öç7B×WBÒW6T×WFF–öâ‡°Ð¢×WFF–öäfã¢‚’Óâ'VÆ´–×÷'D77b‡²FF¢²77bÂWFô&÷fRÒÒ’ÀÐ¢öå7V66W73¢‡#¢ç’’ÓâFö7Bç7V66W72†F—6†W3¢G·"æ7&VFVGÒ7&VFVBÂG·"ç6¶—VBóòÒ6¶—VBÂG·"æf–ÆVBóò"æW'&÷'3òæÆVæwF‚óòÒf–ÆVF’ÀÐ¢öäW'&÷#¢†S¢ç’’ÓâFö7BæW'&÷"†RæÖW76vR’ÀÐ¢Ò“°Ð¢6öç7BÆ6W4×WBÒW6T×WFF–öâ‡°Ð¢×WFF–öäfã¢‚’Óâ–×÷'EÆ6W477b‡²FF¢²77c¢Æ6W477bÂWFô&÷fRÒÒ’ÀÐ¢öå7V66W73¢‡#¢ç’’ÓâFö7Bç7V66W72†Æ6W3¢G·"æ7&VFVGÒ7&VFVBÂG·"ç6¶—VBóòÒ6¶—VBÂG·"æf–ÆVBóò"æW'&÷'3òæÆVæwF‚óòÒf–ÆVF’ÀÐ¢öäW'&÷#¢†S¢ç’’ÓâFö7BæW'&÷"†RæÖW76vR’ÀÐ¢Ò“°Ð¢&WGW&â€Ð¢ÆF—b6Æ74æÖSÒ&×BÓB76R×’Ób#àÐ¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"FW‡B×6Ò#àÐ¢Æ–çWBG—SÒ&6†V6¶&÷‚"6†V6¶VC×¶WFô&÷fWÒöä6†ævS×²†R’Óâ6WDWFô&÷fR†RçF&vWBæ6†V6¶VB—ÒóàÐ¢WFòÖ&÷fR–×÷'FVB&÷w0Ð¢ÂöÆ&VÃàÐ Ð¢Ç6V7F–öâ6Æ74æÖSÒ'76R×’Ó2&÷VæFVBÖÆr&÷&FW"&÷&FW"Ö&÷&FW"&rÖ6&BÓB#àÐ¢ÆF—càÐ¢Æƒ26Æ74æÖSÒ&föçBÖF—7Æ’FW‡BÓ7†Â#ä–×÷'BF—6†W3Âöƒ3àÐ¢Ç6Æ74æÖSÒ&×BÓFW‡B×6ÒFW‡BÖ×WFVBÖf÷&Vw&÷VæB#àÐ¢6öÇVÖç3¢Æ6öFR6Æ74æÖSÒ'&÷VæFVB&rÖ×WFVB‚Ó#æ6FVv÷'•÷6ÇVrÂ7V'G—U÷6ÇVrÂ&V÷6ÇVrÂÆ6UöæÖRÂFG&W72ÂÆBÂÆærÂF—6…öæÖUöVâÂF—6…öæÖU÷F‚Â&–6U÷F†"Â†÷Fõ÷W&ÂÂæ÷FSÂö6öFSâàÐ¢W‡G&W‡÷'B6öÇVÖç2&R–væ÷&VBàÐ¢Â÷àÐ¢ÂöF—càÐ¢ÆF—càÐ¢ÄÆ&VÃä6†ö÷6R55bf–ÆSÂôÆ&VÃàÐ¢Ä–çW@Ð¢G—SÒ&f–ÆR Ð¢66WCÒ"æ77bÇFW‡Bö77b Ð¢öä6†ævS×²†R’Óâ&VD77df–ÆR†RçF&vWBæf–ÆW3òå³ÒÂ6WD77b—ÐÐ¢6Æ74æÖSÒ&f–ÆS¦×"Ó2f–ÆS§&÷VæFVBÖÖBf–ÆS¦&÷&FW"Óf–ÆS¦&r×&–Ö'’f–ÆS§‚Ó2f–ÆS§’ÓãRf–ÆS§FW‡B×6Òf–ÆS¦föçB×6VÖ–&öÆBf–ÆS§FW‡B×&–Ö'’Öf÷&Vw&÷VæB Ð¢óàÐ¢ÂöF—càÐ¢ÅFW‡F&V&÷w3×³'ÒfÇVS×¶77gÒöä6†ævS×²†R’Óâ6WD77b†RçF&vWBçfÇVR—Ò6Æ74æÖSÒ&föçBÖÖöæòFW‡B×‡2"óàÐ¢Ä'WGFöâöä6Æ–6³×²‚’Óâ×WBæ×WFFR‚—ÒF—6&ÆVC×¶×WBæ—5VæF–æwÓç¶×WBæ—5VæF–ærò$–×÷'F–ærâââ"¢$–×÷'BF—6†W2'ÓÂô'WGFöãàÐ¢Ä–×÷'E&W7VÇB&W7VÇC×¶×WBæFFÒóàÐ¢Â÷6V7F–öãàÐ Ð¢Ç6V7F–öâ6Æ74æÖSÒ'76R×’Ó2&÷VæFVBÖÆr&÷&FW"&÷&FW"Ö&÷&FW"&rÖ6&BÓB#àÐ¢ÆF—càÐ¢Æƒ26Æ74æÖSÒ&föçBÖF—7Æ’FW‡BÓ7†Â#ä–×÷'BÆ6W3Âöƒ3àÐ¢Ç6Æ74æÖSÒ&×BÓFW‡B×6ÒFW‡BÖ×WFVBÖf÷&Vw&÷VæB#àÐ¢6öÇVÖç3¢Æ6öFR6Æ74æÖSÒ'&÷VæFVB&rÖ×WFVB‚Ó#ææÖRÂ&V÷6ÇVrÂFG&W72ÂÆBÂÆæsÂö6öFSââW‡G&W‡÷'B6öÇVÖç2&R–væ÷&VBàÐ¢Â÷àÐ¢ÂöF—càÐ¢ÆF—càÐ¢ÄÆ&VÃä6†ö÷6R55bf–ÆSÂôÆ&VÃàÐ¢Ä–çW@Ð¢G—SÒ&f–ÆR Ð¢66WCÒ"æ77bÇFW‡Bö77b Ð¢öä6†ævS×²†R’Óâ&VD77df–ÆR†RçF&vWBæf–ÆW3òå³ÒÂ6WEÆ6W477b—ÐÐ¢6Æ74æÖSÒ&f–ÆS¦×"Ó2f–ÆS§&÷VæFVBÖÖBf–ÆS¦&÷&FW"Óf–ÆS¦&r×&–Ö'’f–ÆS§‚Ó2f–ÆS§’ÓãRf–ÆS§FW‡B×6Òf–ÆS¦föçB×6VÖ–&öÆBf–ÆS§FW‡B×&–Ö'’Öf÷&Vw&÷VæB Ð¢óàÐ¢ÂöF—càÐ¢ÅFW‡F&V&÷w3×³ÒfÇVS×·Æ6W477gÒöä6†ævS×²†R’Óâ6WEÆ6W477b†RçF&vWBçfÇVR—Ò6Æ74æÖSÒ&föçBÖÖöæòFW‡B×‡2"óàÐ¢Ä'WGFöâöä6Æ–6³×²‚’ÓâÆ6W4×WBæ×WFFR‚—ÒF—6&ÆVC×·Æ6W4×WBæ—5VæF–æwÓç·Æ6W4×WBæ—5VæF–ærò$–×÷'F–ærâââ"¢$–×÷'BÆ6W2'ÓÂô'WGFöãàÐ¢Ä–×÷'E&W7VÇB&W7VÇC×·Æ6W4×WBæFFÒóàÐ¢Â÷6V7F–öãàÐ¢ÂöF—càÐ¢“°Ð§ÐÐ Ð¦gVæ7F–öâ–×÷'E&W7VÇB‡²&W7VÇBÓ¢²&W7VÇC¢ç’Ò’°Ð¢–b‚&W7VÇB’&WGW&âçVÆÃ°Ð¢6öç7BÆ–æW2Ò°Ð¢7&VFVC¢G·&W7VÇBæ7&VFVBóòÖÀÐ¢6¶—VC¢G·&W7VÇBç6¶—VBóòÖÀÐ¢f–ÆVC¢G·&W7VÇBæf–ÆVBóò&W7VÇBæW'&÷'3òæÆVæwF‚óòÖÀÐ¢âââ‚‡&W7VÇBç6¶—2óòµÒ’2ç•µÒ’æÖ‚‡2’Óâ&÷rG·2ç&÷wÓ¢G·2ç&V6öçÖ’ÀÐ¢âââ‚‡&W7VÇBæW'&÷'2óòµÒ’2ç•µÒ’æÖ‚†R’Óâ&÷rG¶Rç&÷wÓ¢G¶Rç&V6öçÖ’ÀÐ¢Ó°Ð¢&WGW&âÇ&R6Æ74æÖSÒ'v†—FW76R×&R×w&&÷VæFVB&rÖ×WFVBÓ2FW‡B×‡2#ç¶Æ–æW2æ¦ö–â‚%Æâ"—ÓÂ÷&Sã°Ð§ÐÐ