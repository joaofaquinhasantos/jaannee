import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  amIAdmin,
  getAdminOverview,
  listPending,
  listDishesAdmin,
  moderateDish,
  assignDishCategoryAdmin,
  createCategoryForDishAdmin,
  updateDishAdmin,
  deleteDishAdmin,
  mergeDishAdmin,
  listReports,
  resolveReport,
  bulkImportCsv,
  importPlacesCsv,
  exportDishesCsv,
  exportPlacesCsv,
  upsertCategory,
  upsertArea,
  upsertSubtype,
  upsertCuisine,
  deleteCuisine,
  deleteCategory,
  deleteArea,
  listPendingPlaces,
  moderatePlace,
  listCategoriesAdmin,
  listAreasAdmin,
  listPlacesAdmin,
  mergePlacesAdmin,
  resolveGoogleMapsLinkAdmin,
  updatePlaceAdmin,
} from "@/lib/admin.functions";
import { listCuisines, mapsDirectionsUrl } from "@/lib/dishes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cuisineLabel, groupedCategories } from "@/components/CategoryPicker";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  ImageOff,
  MapPin,
  RefreshCw,
  Tags,
} from "lucide-react";
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

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Admin() {
  const isAdmin = useQuery({ queryKey: ["is-admin"], queryFn: () => amIAdmin() });
  const sections = [
    "overview",
    "pending",
    "dishes",
    "places",
    "reports",
    "taxonomy",
    "import",
  ] as const;
  type AdminSection = (typeof sections)[number];
  const [section, setSection] = useState<AdminSection>("overview");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested && sections.includes(requested as AdminSection)) {
      setSection(requested as AdminSection);
    }
  }, []);

  const changeSection = (next: string) => {
    const valid = sections.includes(next as AdminSection) ? (next as AdminSection) : "overview";
    setSection(valid);
    const url = new URL(window.location.href);
    url.searchParams.set("section", valid);
    window.history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isAdmin.isLoading)
    return (
      <AppShell>
        <p className="text-muted-foreground">Loading…</p>
      </AppShell>
    );
  if (!isAdmin.data?.admin)
    return (
      <AppShell>
        <section className="mx-auto max-w-xl py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Restricted</p>
          <h1 className="type-page-title mt-3">Admin access required</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            This area is available only to authorised JaanNee administrators.
          </p>
        </section>
      </AppShell>
    );

  return (
    <AppShell>
      <section className="border-b border-border pb-7">
        <p className="text-xs font-bold uppercase text-primary">Operations</p>
        <h1 className="type-page-title mt-2">Admin</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Keep the board clean: approve dishes, resolve reports, and manage the taxonomy behind the
          public ranking.
        </p>
      </section>
      <Tabs value={section} onValueChange={changeSection} className="mt-6">
        <TabsList className="sticky top-2 z-20 h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-secondary/95 p-1 shadow-sm backdrop-blur">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="dishes">Dishes</TabsTrigger>
          <TabsTrigger value="places">Places</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="taxonomy">Cuisines, Categories & Areas</TabsTrigger>
          <TabsTrigger value="import">Bulk import</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <AdminOverview onNavigate={changeSection} />
        </TabsContent>
        <TabsContent value="pending">
          <PendingList />
        </TabsContent>
        <TabsContent value="dishes">
          <DishAdmin />
        </TabsContent>
        <TabsContent value="places">
          <PendingPlaces />
        </TabsContent>
        <TabsContent value="reports">
          <Reports />
        </TabsContent>
        <TabsContent value="taxonomy">
          <Taxonomy />
        </TabsContent>
        <TabsContent value="import">
          <Import />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function AdminStat({
  label,
  value,
  description,
  icon: Icon,
  onClick,
  urgent,
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof ClipboardCheck;
  onClick: () => void;
  urgent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/60 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <Icon
          className={urgent && value > 0 ? "text-primary" : "text-muted-foreground"}
          size={20}
        />
        <ChevronRight
          className="text-muted-foreground transition group-hover:translate-x-0.5"
          size={18}
        />
      </div>
      <p className={`type-stat mt-5 ${urgent && value > 0 ? "text-primary" : "text-accent"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

function AdminOverview({ onNavigate }: { onNavigate: (section: string) => void }) {
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => getAdminOverview() });
  if (overview.isLoading) return <AdminLoading label="Loading operations overview…" />;
  if (overview.isError)
    return (
      <AdminError
        message="The operations overview could not be loaded."
        retry={() => overview.refetch()}
      />
    );
  const data = overview.data!;
  return (
    <div className="mt-5 space-y-6">
      <div>
        <h2 className="type-section-title">What needs attention</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with moderation queues, then resolve catalogue quality warnings.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <AdminStat
          label="Pending dishes"
          value={data.pendingDishes}
          description="Review diner submissions"
          icon={ClipboardCheck}
          urgent
          onClick={() => onNavigate("pending")}
        />
        <AdminStat
          label="Pending places"
          value={data.pendingPlaces}
          description="Verify new locations"
          icon={MapPin}
          urgent
          onClick={() => onNavigate("places")}
        />
        <AdminStat
          label="Open reports"
          value={data.openReports}
          description="Resolve community flags"
          icon={FileWarning}
          urgent
          onClick={() => onNavigate("reports")}
        />
        <AdminStat
          label="Missing photos"
          value={data.missingPhotos}
          description="Complete approved dishes"
          icon={ImageOff}
          onClick={() => onNavigate("dishes")}
        />
        <AdminStat
          label="Taxonomy warnings"
          value={data.taxonomyWarnings}
          description="Dish types required"
          icon={Tags}
          urgent
          onClick={() => onNavigate("taxonomy")}
        />
      </div>
      {Object.values(data).every((value) => value === 0) && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="font-semibold text-emerald-200">Everything is clear</p>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no moderation queues or catalogue warnings right now.
          </p>
        </div>
      )}
    </div>
  );
}

function AdminLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      <RefreshCw className="animate-spin" size={16} />
      {label}
    </div>
  );
}

function AdminError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 text-destructive" size={18} />
        <div className="flex-1">
          <p className="font-semibold">Could not load this section</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdminPager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="text-xs font-semibold">
          Page {page} of {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function PendingPlaces() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pending-places"], queryFn: () => listPendingPlaces() });
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: () => listAreasAdmin() });
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any | null>(null);
  const [mergePlaceSource, setMergePlaceSource] = useState<any | null>(null);
  const [mergePlaceTargetId, setMergePlaceTargetId] = useState("");
  const [placeForm, setPlaceForm] = useState({
    name: "",
    areaId: "",
    address: "",
    status: "pending",
    mapsUrl: "",
  });
  const places = useQuery({
    queryKey: ["admin-places", debouncedQuery, page],
    queryFn: () => listPlacesAdmin({ data: { query: debouncedQuery, page } }),
  });
  useEffect(() => setPage(1), [debouncedQuery]);
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
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const placeMut = useMutation({
    mutationFn: (v: {
      id: string;
      name: string;
      areaId: string;
      address?: string;
      status: "approved" | "pending" | "rejected";
      lat?: number | null;
      lng?: number | null;
    }) => updatePlaceAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Place saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["pending-places"] });
      qc.invalidateQueries({ queryKey: ["admin-places"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mapsMut = useMutation({
    mutationFn: (url: string) => resolveGoogleMapsLinkAdmin({ data: { url } }),
  });
  const mergePlaceMut = useMutation({
    mutationFn: () =>
      mergePlacesAdmin({
        data: { keepId: mergePlaceTargetId, removeId: mergePlaceSource.id },
      }),
    onSuccess: () => {
      toast.success("Places merged");
      setMergePlaceSource(null);
      setMergePlaceTargetId("");
      qc.invalidateQueries({ queryKey: ["pending-places"] });
      qc.invalidateQueries({ queryKey: ["admin-places"] });
      qc.invalidateQueries({ queryKey: ["admin-dishes"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const openPlaceEditor = (p: any) => {
    setEditing(p);
    setPlaceForm({
      name: p.name ?? "",
      areaId: p.area?.id ?? "",
      address: p.address ?? "",
      status: p.status ?? "pending",
      mapsUrl: "",
    });
  };
  const savePlace = async () => {
    if (!editing) return;
    try {
      const coords = placeForm.mapsUrl.trim()
        ? await mapsMut.mutateAsync(placeForm.mapsUrl.trim())
        : { lat: editing.lat ?? null, lng: editing.lng ?? null };
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
  return (
    <div className="mt-4 space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="type-section-title">Pending places</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve new places created from the submit flow.
          </p>
        </div>
        {q.isLoading && <AdminLoading label="Loading pending places…" />}
        {q.isError && (
          <AdminError message="Pending places could not be loaded." retry={() => q.refetch()} />
        )}
        {!q.isLoading &&
          !q.isError &&
          (q.data ?? []).map((p: any) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.area?.name_en}
                  {p.address ? ` · ${p.address}` : ""}
                </div>
              </div>
              <Button size="sm" onClick={() => mut.mutate({ id: p.id, action: "approve" })}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => mut.mutate({ id: p.id, action: "reject" })}
              >
                Reject
              </Button>
            </div>
          ))}
        {!q.isLoading && !q.isError && (q.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No pending places.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="type-section-title">Place locations</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a Google Maps link so nearby place picking works accurately.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => exportMut.mutate()}
              disabled={exportMut.isPending}
            >
              {exportMut.isPending ? "Exporting..." : "Export places"}
            </Button>
          </div>
          <Input
            className="mt-3 max-w-md"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search place, address, area"
          />
        </div>
        {places.isLoading && <AdminLoading label="Loading places…" />}
        {places.isError && (
          <AdminError message="Places could not be loaded." retry={() => places.refetch()} />
        )}
        {!places.isLoading &&
          !places.isError &&
          (places.data?.items ?? []).map((p: any) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.area?.name_en}
                  {p.address ? ` / ${p.address}` : ""} / {p.status}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.lat != null && p.lng != null
                    ? "Google Maps location saved"
                    : "Location needed"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={mapsDirectionsUrl(p)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" type="button">
                    Open in Maps
                  </Button>
                </a>
                <Button size="sm" variant="outline" onClick={() => openPlaceEditor(p)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMergePlaceSource(p);
                    setMergePlaceTargetId("");
                  }}
                >
                  Merge
                </Button>
              </div>
            </div>
          ))}
        {places.data && (
          <AdminPager
            page={places.data.page}
            pageSize={places.data.pageSize}
            total={places.data.total}
            onPage={setPage}
          />
        )}
      </section>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit place</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={placeForm.name}
                  onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Area</Label>
                <Select
                  value={placeForm.areaId}
                  onValueChange={(v) => setPlaceForm({ ...placeForm, areaId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose area" />
                  </SelectTrigger>
                  <SelectContent>
                    {(areas.data ?? []).map((area: any) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={placeForm.address}
                  onChange={(e) => setPlaceForm({ ...placeForm, address: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={placeForm.status}
                  onValueChange={(v) => setPlaceForm({ ...placeForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Google Maps link</Label>
                <Input
                  type="url"
                  value={placeForm.mapsUrl}
                  onChange={(e) => setPlaceForm({ ...placeForm, mapsUrl: e.target.value })}
                  placeholder="https://maps.app.goo.gl/..."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Open the place in Google Maps, tap Share, and paste the link here.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={savePlace}
              disabled={
                placeMut.isPending ||
                mapsMut.isPending ||
                !placeForm.name.trim() ||
                !placeForm.areaId
              }
            >
              {mapsMut.isPending ? "Reading Maps link..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!mergePlaceSource} onOpenChange={(open) => !open && setMergePlaceSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge duplicate place</DialogTitle>
          </DialogHeader>
          {mergePlaceSource ? (
            <div className="space-y-4">
              <p className="text-sm">
                Remove <span className="font-semibold">{mergePlaceSource.name}</span> and move all
                of its dishes to the place you keep.
              </p>
              <div>
                <Label>Keep place</Label>
                <Select value={mergePlaceTargetId} onValueChange={setMergePlaceTargetId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose place to keep" />
                  </SelectTrigger>
                  <SelectContent>
                    {(places.data?.items ?? [])
                      .filter((place: any) => place.id !== mergePlaceSource.id)
                      .map((place: any) => (
                        <SelectItem key={place.id} value={place.id}>
                          {place.name} / {place.area?.name_en ?? "No area"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                The kept place retains its name and area. Missing address or map coordinates are
                copied from the removed place. The merge is blocked if it would create duplicate
                dish names at the kept place.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergePlaceSource(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => mergePlaceMut.mutate()}
              disabled={!mergePlaceTargetId || mergePlaceMut.isPending}
            >
              Merge places
            </Button>
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
  const [assigningSubtype, setAssigningSubtype] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<any | null>(null);
  const [correcting, setCorrecting] = useState<Record<string, boolean>>({});
  const mut = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject" }) => moderateDish({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const assignMut = useMutation({
    mutationFn: (v: { dishId: string; categoryId: string; subtypeId?: string | null }) =>
      assignDishCategoryAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Category assigned");
      qc.invalidateQueries({ queryKey: ["pending"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const createMut = useMutation({
    mutationFn: () => createCategoryForDishAdmin({ data: creating }),
    onSuccess: (r: any) => {
      if (r?.requires_subtype) {
        toast.success("Category created. Add and assign a dish type before approving this dish.");
      } else {
        toast.success("Category created and assigned");
      }
      setCreating(null);
      qc.invalidateQueries({ queryKey: ["pending"] });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const catsList = (cats.data ?? []) as any[];
  const findCat = (id: string | null | undefined) =>
    id ? catsList.find((c: any) => c.id === id) : null;
  return (
    <div className="mt-4 space-y-3">
      {q.isLoading && <AdminLoading label="Loading pending dishes…" />}
      {q.isError && (
        <AdminError message="Pending dishes could not be loaded." retry={() => q.refetch()} />
      )}
      {!q.isLoading &&
        !q.isError &&
        (q.data ?? []).map((d: any) => (
          <div
            key={d.id}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
          >
            <a
              href={d.photo_url || undefined}
              target={d.photo_url ? "_blank" : undefined}
              rel="noreferrer"
              className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"
              aria-label={d.photo_url ? `Open photo for ${d.name_en}` : undefined}
            >
              {d.photo_url ? (
                <img src={d.photo_url} className="h-full w-full object-cover" alt="" />
              ) : (
                <span className="flex h-full items-center justify-center text-center text-[10px] text-muted-foreground">
                  No photo
                </span>
              )}
            </a>
            <PendingDishRow
              d={d}
              catsList={catsList}
              findCat={findCat}
              assigning={assigning}
              setAssigning={setAssigning}
              assigningSubtype={assigningSubtype}
              setAssigningSubtype={setAssigningSubtype}
              correcting={correcting}
              setCorrecting={setCorrecting}
              assignMut={assignMut}
              mut={mut}
              setCreating={setCreating}
            />
          </div>
        ))}
      {!q.isLoading && !q.isError && (q.data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Queue is empty.</p>
      )}
      <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create category for pending dish</DialogTitle>
          </DialogHeader>
          {creating && (
            <div className="space-y-3">
              <div>
                <Label>Slug *</Label>
                <Input
                  value={creating.slug}
                  onChange={(e) => setCreating({ ...creating, slug: e.target.value })}
                />
              </div>
              <div>
                <Label>Name (EN) *</Label>
                <Input
                  value={creating.name_en}
                  onChange={(e) => setCreating({ ...creating, name_en: e.target.value })}
                />
              </div>
              <div>
                <Label>Name (TH) *</Label>
                <Input
                  value={creating.name_th}
                  onChange={(e) => setCreating({ ...creating, name_th: e.target.value })}
                />
              </div>
              <div>
                <Label>Cuisine</Label>
                <Select
                  value={creating.cuisine || "none"}
                  onValueChange={(v) =>
                    setCreating({ ...creating, cuisine: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Other" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Other</SelectItem>
                    {(cuisines.data ?? [])
                      .filter((c: any) => c.slug !== "other")
                      .map((c: any) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.name_en}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-start gap-2 rounded-md border border-border bg-background p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!creating.requires_subtype}
                  onChange={(e) => setCreating({ ...creating, requires_subtype: e.target.checked })}
                />
                <span>
                  <span className="font-semibold">Requires dish type</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Dish stays pending until you add and assign a dish type in this category.
                  </span>
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(null)}>
              Cancel
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              Create and assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DishAdmin() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [page, setPage] = useState(1);
  const [missingPhotoOnly, setMissingPhotoOnly] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<any | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingDish, setDeletingDish] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const dishes = useQuery({
    queryKey: ["admin-dishes", debouncedQuery, missingPhotoOnly, page],
    queryFn: () => listDishesAdmin({ data: { query: debouncedQuery, missingPhotoOnly, page } }),
  });
  useEffect(() => setPage(1), [debouncedQuery, missingPhotoOnly]);
  const exportMut = useMutation({
    mutationFn: () => exportDishesCsv(),
    onSuccess: (csv) => downloadCsv("jaannee-dishes.csv", csv as string),
    onError: (e: any) => toast.error(e.message),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-dishes"] });
  const photoMut = useMutation({
    mutationFn: () =>
      updateDishAdmin({ data: { id: editingPhoto.id, photo_url: photoUrl || undefined } }),
    onSuccess: () => {
      toast.success("Photo updated");
      setEditingPhoto(null);
      setPhotoUrl("");
      invalidate();
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      validatePhotoFile(file);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in before uploading photos");
      const path = buildPhotoPath(userData.user.id, file);
      const { error } = await supabase.storage
        .from("dish-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
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
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
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
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="type-section-title">Dishes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add photos later, delete bad entries, or merge duplicates into the dish you want to keep.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            className="max-w-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dish, place, category"
          />
          <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={missingPhotoOnly}
              onChange={(e) => setMissingPhotoOnly(e.target.checked)}
            />
            Missing photo only
          </label>
          <Button
            variant="outline"
            onClick={() => exportMut.mutate()}
            disabled={exportMut.isPending}
          >
            {exportMut.isPending ? "Exporting..." : "Export dishes"}
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {(dishes.data?.items ?? []).map((d: any) => (
          <div
            key={d.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              {d.photo_url ? (
                <img src={d.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No photo
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{d.name_en}</div>
              <div className="text-xs text-muted-foreground">
                {d.place?.name} / {d.place?.area?.name_en} / {d.category?.name_en} / {d.status} /{" "}
                {d.comparisons_count ?? 0} comparisons
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{d.id}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingPhoto(d);
                    setPhotoUrl(d.photo_url ?? "");
                  }}
                >
                  Photo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(d.comparisons_count ?? 0) > 0}
                  onClick={() => {
                    setMergeSource(d);
                    setMergeTargetId("");
                  }}
                >
                  Merge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(d.comparisons_count ?? 0) > 0}
                  onClick={() => setDeletingDish(d)}
                >
                  Delete
                </Button>
              </div>
              {(d.comparisons_count ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ranking history protects this dish from merging or deletion.
                </p>
              )}
            </div>
          </div>
        ))}
        {dishes.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!dishes.isLoading && !dishes.isError && (dishes.data?.items ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No dishes found.</p>
        )}
        {dishes.isError && (
          <AdminError message="Dishes could not be loaded." retry={() => dishes.refetch()} />
        )}
        {dishes.data && (
          <AdminPager
            page={dishes.data.page}
            pageSize={dishes.data.pageSize}
            total={dishes.data.total}
            onPage={setPage}
          />
        )}
      </div>
      <Dialog open={!!editingPhoto} onOpenChange={(o) => !o && setEditingPhoto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update photo</DialogTitle>
          </DialogHeader>
          {editingPhoto && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{editingPhoto.name_en}</p>
              <div>
                <Label>Photo URL or /photos/ path</Label>
                <Input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="/photos/dish.jpg"
                />
              </div>
              <div>
                <Label>Upload from device</Label>
                <Input
                  type="file"
                  accept={PHOTO_ACCEPT_ATTR}
                  disabled={uploadingPhoto}
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    const file = input.files?.[0];
                    if (file) {
                      try {
                        await uploadPhoto(file);
                      } finally {
                        input.value = "";
                      }
                    }
                  }}
                  className="file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  JPEG, PNG, or WebP up to 8 MB. Choose a local image, then save the uploaded photo
                  path.
                </p>
              </div>
              {photoUrl && (
                <img src={photoUrl} className="h-28 w-28 rounded-lg object-cover" alt="Preview" />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPhoto(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => photoMut.mutate()}
              disabled={photoMut.isPending || uploadingPhoto}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deletingDish} onOpenChange={(o) => !o && setDeletingDish(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete dish</DialogTitle>
          </DialogHeader>
          {deletingDish && (
            <div className="space-y-2 text-sm">
              <p>
                Delete <span className="font-semibold">{deletingDish.name_en}</span>?
              </p>
              <p className="text-muted-foreground">
                Dishes with ranking history are protected and cannot be deleted. Zero-comparison
                dishes can be removed; tried marks and reports for the dish go with it. This action
                cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDish(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!mergeSource} onOpenChange={(o) => !o && setMergeSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge duplicate dish</DialogTitle>
          </DialogHeader>
          {mergeSource && (
            <div className="space-y-3">
              <p className="text-sm">
                Remove <span className="font-semibold">{mergeSource.name_en}</span> and keep another
                dish.
              </p>
              <div>
                <Label>Keep dish</Label>
                {(() => {
                  const candidates = (dishes.data?.items ?? []).filter(
                    (d: any) =>
                      d.id !== mergeSource.id &&
                      (d.comparisons_count ?? 0) === 0 &&
                      (mergeSource.comparisons_count ?? 0) === 0 &&
                      d.place_id === mergeSource.place_id &&
                      d.category_id === mergeSource.category_id &&
                      (d.subtype_id ?? null) === (mergeSource.subtype_id ?? null),
                  );
                  if (candidates.length === 0) {
                    return (
                      <p className="rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
                        No safe duplicate target is available. Both dishes must be at the same
                        place, in the same ranking pool, and have zero comparisons.
                      </p>
                    );
                  }
                  return (
                    <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose dish to keep" />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name_en} / {d.place?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground">
                Merging is only allowed before either dish has any comparison history. Both dishes
                must share the same place, category, and dish type. Tried marks and reports move to
                the kept dish; comparison rows, Elo, and comparisons_count are never rewritten.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeSource(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => mergeMut.mutate()}
              disabled={mergeMut.isPending || !mergeTargetId}
            >
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendingDishRow(props: {
  d: any;
  catsList: any[];
  findCat: (id: string | null | undefined) => any;
  assigning: Record<string, string>;
  setAssigning: (v: Record<string, string>) => void;
  assigningSubtype: Record<string, string>;
  setAssigningSubtype: (v: Record<string, string>) => void;
  correcting: Record<string, boolean>;
  setCorrecting: (v: Record<string, boolean>) => void;
  assignMut: any;
  mut: any;
  setCreating: (v: any) => void;
}) {
  const {
    d,
    catsList,
    findCat,
    assigning,
    setAssigning,
    assigningSubtype,
    setAssigningSubtype,
    correcting,
    setCorrecting,
    assignMut,
    mut,
    setCreating,
  } = props;
  const currentCat = findCat(d.category_id);
  const currentActiveSubs = ((currentCat?.subtypes ?? []) as any[]).filter((s: any) => s.is_active);
  const currentScoped = Boolean(currentCat?.requires_subtype) || currentActiveSubs.length > 0;
  const currentSubtypeOk =
    !currentScoped || (!!d.subtype_id && currentActiveSubs.some((s: any) => s.id === d.subtype_id));
  const showCorrect = !!correcting[d.id];
  const showAssignBlock = !d.category_id || showCorrect || (currentScoped && !currentSubtypeOk);
  const chosenCatId = assigning[d.id] ?? d.category_id ?? "";
  const chosenCat = findCat(chosenCatId);
  const activeSubs = ((chosenCat?.subtypes ?? []) as any[]).filter((s: any) => s.is_active);
  const requires = Boolean(chosenCat?.requires_subtype);
  const scoped = requires || activeSubs.length > 0;
  const incomplete = requires && activeSubs.length === 0;
  const defaultSub = chosenCatId === d.category_id ? (d.subtype_id ?? "") : "";
  const subId = assigningSubtype[d.id] ?? defaultSub;
  const canAssign = !!chosenCatId && !incomplete && (!scoped || !!subId);
  const canApprove = !!d.category_id && currentSubtypeOk;
  return (
    <div className="min-w-0 flex-1">
      <div className="font-medium">{d.name_en}</div>
      <div className="text-xs text-muted-foreground">
        {d.place?.name} · {d.place?.area?.name_en} · {d.category?.name_en ?? "no category"}{" "}
        {d.price_thb && `· ฿${d.price_thb}`}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Submitted {new Date(d.created_at).toLocaleDateString()}
      </div>
      {d.note && <div className="mt-1 text-xs italic text-muted-foreground">{d.note}</div>}
      {d.category_id && (
        <div className="mt-2 text-xs text-muted-foreground">
          Dish type:{" "}
          <span className="font-semibold">
            {d.subtype?.name_en ?? (currentScoped ? "— (required)" : "not applicable")}
          </span>
          {" · "}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => setCorrecting({ ...correcting, [d.id]: !showCorrect })}
          >
            {showCorrect ? "Cancel" : "Change category or type"}
          </button>
        </div>
      )}
      {showAssignBlock && (
        <div className="mt-3 rounded-md border border-dashed border-border bg-background p-3">
          {!d.category_id ? (
            <>
              <p className="text-xs font-bold uppercase text-primary">Requested new category</p>
              <p className="mt-1 text-sm font-medium">
                {d.requested_category_en}
                {d.requested_category_th ? ` / ${d.requested_category_th}` : ""}
              </p>
            </>
          ) : (
            <p className="text-xs font-bold uppercase text-primary">
              {currentScoped && !currentSubtypeOk ? "Dish type required" : "Reassign category"}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Select
              value={chosenCatId}
              onValueChange={(v) => {
                setAssigning({ ...assigning, [d.id]: v });
                setAssigningSubtype({ ...assigningSubtype, [d.id]: "" });
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Assign existing category" />
              </SelectTrigger>
              <SelectContent>
                {catsList.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {scoped && (
              <Select
                value={subId}
                onValueChange={(v) => setAssigningSubtype({ ...assigningSubtype, [d.id]: v })}
                disabled={incomplete}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Choose dish type" />
                </SelectTrigger>
                <SelectContent>
                  {activeSubs.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!canAssign || assignMut.isPending}
              onClick={() => {
                assignMut.mutate({
                  dishId: d.id,
                  categoryId: chosenCatId,
                  subtypeId: scoped ? subId : null,
                });
                setCorrecting({ ...correcting, [d.id]: false });
              }}
            >
              Save
            </Button>
            {!d.category_id && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setCreating({
                    dishId: d.id,
                    slug: (d.requested_category_en ?? "")
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                    name_en: d.requested_category_en ?? "",
                    name_th: d.requested_category_th || d.requested_category_en || "",
                    cuisine: "",
                    requires_subtype: false,
                  })
                }
              >
                Create category
              </Button>
            )}
            {incomplete && (
              <p className="w-full text-xs font-medium text-primary">
                Create and activate a dish type for this category before assigning the dish.
              </p>
            )}
          </div>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={!canApprove || mut.isPending}
          onClick={() => mut.mutate({ id: d.id, action: "approve" })}
        >
          Approve dish
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => mut.mutate({ id: d.id, action: "reject" })}
        >
          Reject dish
        </Button>
      </div>
    </div>
  );
}

function Reports() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["reports"], queryFn: () => listReports() });
  const mut = useMutation({
    mutationFn: (v: { id: string; status: "resolved" | "dismissed" }) => resolveReport({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-3">
      {q.isLoading && <AdminLoading label="Loading reports…" />}
      {q.isError && <AdminError message="Reports could not be loaded." retry={() => q.refetch()} />}
      {!q.isLoading &&
        !q.isError &&
        (q.data ?? []).map((r: any) => (
          <div
            key={r.id}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {r.dish?.name_en}{" "}
                <span className="text-xs text-muted-foreground">({r.dish?.place?.name})</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {r.reason}
                {r.note ? ` — ${r.note}` : ""}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Reported {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
            <Button size="sm" onClick={() => mut.mutate({ id: r.id, status: "resolved" })}>
              Resolve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => mut.mutate({ id: r.id, status: "dismissed" })}
            >
              Dismiss
            </Button>
          </div>
        ))}
      {!q.isLoading && !q.isError && (q.data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No open reports.</p>
      )}
    </div>
  );
}

function Taxonomy() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [c, setC] = useState<{
    slug: string;
    name_en: string;
    name_th: string;
    cuisine: string;
    requires_subtype: boolean;
    reference_photo_url: string;
  }>({
    slug: "",
    name_en: "",
    name_th: "",
    cuisine: "",
    requires_subtype: false,
    reference_photo_url: "",
  });
  const [uploadingCategoryPhoto, setUploadingCategoryPhoto] = useState(false);
  const [cu, setCu] = useState({ slug: "", name_en: "", name_th: "" });
  const [a, setA] = useState({ slug: "", name_en: "", name_th: "" });
  const [catFilter, setCatFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [sub, setSub] = useState({
    category_id: "",
    slug: "",
    name_en: "",
    name_th: "",
    display_order: 0,
  });
  const cats = useQuery({ queryKey: ["admin-categories"], queryFn: () => listCategoriesAdmin() });
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: () => listAreasAdmin() });
  const cuisines = useQuery({ queryKey: ["cuisines"], queryFn: () => listCuisines() });
  const [editing, setEditing] = useState<{
    kind: "category" | "area";
    slug: string;
    name_en: string;
    name_th: string;
    cuisine?: string;
    requires_subtype?: boolean;
    reference_photo_url?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<
    | { kind: "category" | "area"; id: string; name_en: string; slug: string }
    | { kind: "cuisine"; name_en: string; slug: string }
    | null
  >(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  useEffect(() => setDeleteConfirmation(""), [deleting]);
  const [editingSubtype, setEditingSubtype] = useState<any | null>(null);
  const requireOk = (result: any) => {
    if (!result?.ok) throw new Error(result?.error?.message ?? result?.error ?? "Save failed");
    return result;
  };
  const cMut = useMutation({
    mutationFn: async () => requireOk(await upsertCategory({ data: c })),
    onSuccess: () => {
      toast.success("Saved");
      setC({
        slug: "",
        name_en: "",
        name_th: "",
        cuisine: "",
        requires_subtype: false,
        reference_photo_url: "",
      });
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
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
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
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
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
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
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
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const editMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload: any = {
        slug: editing.slug,
        name_en: editing.name_en,
        name_th: editing.name_th,
        cuisine: editing.cuisine,
      };
      if (editing.kind === "category") payload.requires_subtype = !!editing.requires_subtype;
      if (editing.kind === "category")
        payload.reference_photo_url = editing.reference_photo_url ?? "";
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
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!deleting) return;
      if (deleting.kind === "category")
        requireOk(await deleteCategory({ data: { id: deleting.id } }));
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
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
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
  const saveC = () => {
    const err = validate(c);
    if (err) {
      toast.error(err);
      return;
    }
    cMut.mutate();
  };
  const saveCu = () => {
    const err = validate(cu);
    if (err) {
      toast.error(err);
      return;
    }
    cuMut.mutate();
  };
  const saveA = () => {
    const err = validate(a);
    if (err) {
      toast.error(err);
      return;
    }
    aMut.mutate();
  };
  const saveSub = () => {
    const err = validate(sub);
    if (!sub.category_id) {
      toast.error("Choose a category");
      return;
    }
    if (err) {
      toast.error(err);
      return;
    }
    subMut.mutate();
  };
  const uploadCategoryPhoto = async (file: File, onUploaded: (url: string) => void) => {
    setUploadingCategoryPhoto(true);
    try {
      validatePhotoFile(file);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);
      if (!userData.user) throw new Error("Sign in before uploading photos");
      const path = buildPhotoPath(userData.user.id, file);
      const { error } = await supabase.storage
        .from("dish-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      onUploaded(`/photos/${path}`);
      toast.success("Category reference photo uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingCategoryPhoto(false);
    }
  };
  const saveEdit = () => {
    if (!editing) return;
    if (!editing.name_en.trim() || !editing.name_th.trim()) {
      toast.error("Both names are required");
      return;
    }
    editMut.mutate();
  };
  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-4 md:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="type-section-title">Cuisines</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add cuisine groups here, then assign categories to them below.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <div>
            <Label>Slug *</Label>
            <Input
              value={cu.slug}
              onChange={(e) => setCu({ ...cu, slug: e.target.value })}
              placeholder="korean"
            />
          </div>
          <div>
            <Label>Name (EN) *</Label>
            <Input value={cu.name_en} onChange={(e) => setCu({ ...cu, name_en: e.target.value })} />
          </div>
          <div>
            <Label>Name (TH) *</Label>
            <Input value={cu.name_th} onChange={(e) => setCu({ ...cu, name_th: e.target.value })} />
          </div>
          <Button onClick={saveCu} disabled={cuMut.isPending}>
            Save
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(cuisines.data ?? []).map((row: any) => (
            <div
              key={row.slug}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="font-medium">{row.name_en}</span>
              <span className="text-xs text-muted-foreground">{row.slug}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDeleting({ kind: "cuisine", name_en: row.name_en, slug: row.slug })
                }
              >
                Delete
              </Button>
            </div>
          ))}
          {(cuisines.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No cuisines yet.</p>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="type-section-title">Categories</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add categories, choose their cuisine group, or delete unused ones.
        </p>
        <div className="mt-3 space-y-2">
          <div>
            <Label>Slug *</Label>
            <Input
              value={c.slug}
              onChange={(e) => setC({ ...c, slug: e.target.value })}
              placeholder="pad-kra-pao"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, digits, hyphens only.
            </p>
          </div>
          <div>
            <Label>Name (EN) *</Label>
            <Input value={c.name_en} onChange={(e) => setC({ ...c, name_en: e.target.value })} />
          </div>
          <div>
            <Label>Name (TH) *</Label>
            <Input value={c.name_th} onChange={(e) => setC({ ...c, name_th: e.target.value })} />
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <Label>Reference photo</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              A visual example for category navigation. It does not enter rankings.
            </p>
            {c.reference_photo_url && (
              <img
                src={c.reference_photo_url}
                alt=""
                className="mt-2 h-28 w-full rounded-md object-cover"
              />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                type="file"
                accept={PHOTO_ACCEPT_ATTR}
                disabled={uploadingCategoryPhoto}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    await uploadCategoryPhoto(file, (url) =>
                      setC((current) => ({ ...current, reference_photo_url: url })),
                    );
                  e.currentTarget.value = "";
                }}
              />
              {c.reference_photo_url && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setC({ ...c, reference_photo_url: "" })}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label>{t("cuisine")}</Label>
            <Select
              value={c.cuisine || "none"}
              onValueChange={(v) => setC({ ...c, cuisine: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Other" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("cuisine_other")}</SelectItem>
                {(cuisines.data ?? [])
                  .filter((item: any) => item.slug !== "other")
                  .map((item: any) => (
                    <SelectItem key={item.slug} value={item.slug}>
                      {item.name_en}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-start gap-2 rounded-md border border-border bg-background p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={c.requires_subtype}
              onChange={(e) => setC({ ...c, requires_subtype: e.target.checked })}
            />
            <span>
              <span className="font-semibold">Requires dish type</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Dishes in this category cannot be approved without a dish type (e.g. Sushi → Nigiri
                Salmon).
              </span>
            </span>
          </label>
          <Button onClick={saveC} disabled={cMut.isPending}>
            Save
          </Button>
        </div>
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-muted-foreground">Existing categories</h4>
          <Input
            className="mt-2"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            placeholder={t("filter_categories")}
          />
          {(() => {
            const q = catFilter.trim().toLowerCase();
            const hasFilter = q.length > 0;
            const baseGroups = groupedCategories(cats.data ?? [], "");
            const groups = hasFilter
              ? baseGroups
                  .map(([cuisine, rows]) => {
                    const cuisineHit = cuisineLabel(cuisine, t).toLowerCase().includes(q);
                    const filteredRows = cuisineHit
                      ? rows
                      : rows.filter((r: any) =>
                          [r.name_en, r.name_th, r.slug]
                            .filter(Boolean)
                            .some((v: string) => String(v).toLowerCase().includes(q)),
                        );
                    return [cuisine, filteredRows] as [string, any[]];
                  })
                  .filter(([, rows]) => rows.length > 0)
              : baseGroups;
            return (
              <div className="mt-2 space-y-2">
                {groups.map(([cuisine, rows]) => (
                  <details
                    key={cuisine}
                    open={hasFilter || undefined}
                    className="group rounded-lg border border-border bg-background"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                        <span className="font-semibold">{cuisineLabel(cuisine, t)}</span>
                        <span className="text-xs text-muted-foreground">
                          — {rows.length} {rows.length === 1 ? "category" : "categories"}
                        </span>
                      </span>
                    </summary>
                    <div className="divide-y divide-border border-t border-border">
                      {rows.map((row: any) => (
                        <div key={row.slug} className="px-3 py-3 text-sm">
                          {(() => {
                            const activeCount = ((row.subtypes ?? []) as any[]).filter(
                              (s: any) => s.is_active,
                            ).length;
                            return (
                              <>
                                <div className="flex items-center justify-between gap-3">
                                  {row.reference_photo_url && (
                                    <img
                                      src={row.reference_photo_url}
                                      alt=""
                                      className="h-12 w-16 shrink-0 rounded-md object-cover"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">
                                      {row.name_en}{" "}
                                      <span className="text-muted-foreground">/ {row.name_th}</span>
                                      {row.requires_subtype && (
                                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                                          Requires type
                                        </span>
                                      )}
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground">
                                      {row.slug} · {activeCount} active dish type
                                      {activeCount === 1 ? "" : "s"}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setEditing({
                                          kind: "category",
                                          slug: row.slug,
                                          name_en: row.name_en,
                                          name_th: row.name_th,
                                          cuisine: row.cuisine || "",
                                          requires_subtype: !!row.requires_subtype,
                                          reference_photo_url: row.reference_photo_url || "",
                                        })
                                      }
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setDeleting({
                                          kind: "category",
                                          id: row.id,
                                          name_en: row.name_en,
                                          slug: row.slug,
                                        })
                                      }
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                                <details className="group/types mt-2">
                                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary [&::-webkit-details-marker]:hidden">
                                    <ChevronRight className="h-3 w-3 transition-transform group-open/types:rotate-90" />
                                    Manage types
                                    {(row.subtypes ?? []).length
                                      ? ` (${(row.subtypes ?? []).length})`
                                      : ""}
                                  </summary>
                                  <div className="mt-2 space-y-2 border-t border-border pt-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-bold uppercase text-muted-foreground">
                                        Dish types
                                      </p>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setSub({
                                            category_id: row.id,
                                            slug: "",
                                            name_en: "",
                                            name_th: "",
                                            display_order: 0,
                                          })
                                        }
                                      >
                                        Add type
                                      </Button>
                                    </div>
                                    {(row.subtypes ?? [])
                                      .sort(
                                        (x: any, y: any) =>
                                          (x.display_order ?? 0) - (y.display_order ?? 0) ||
                                          x.name_en.localeCompare(y.name_en),
                                      )
                                      .map((s: any) => (
                                        <div
                                          key={s.id}
                                          className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                                        >
                                          <div className="min-w-0">
                                            <div className="truncate font-medium">
                                              {s.name_en}{" "}
                                              <span className="text-muted-foreground">
                                                / {s.name_th}
                                              </span>
                                            </div>
                                            <div className="truncate text-xs text-muted-foreground">
                                              {s.slug} / {s.is_active ? "active" : "inactive"}
                                            </div>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              setEditingSubtype({ ...s, category_id: row.id })
                                            }
                                          >
                                            Edit
                                          </Button>
                                        </div>
                                      ))}
                                    {(row.subtypes ?? []).length === 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        No dish types for this category.
                                      </p>
                                    )}
                                  </div>
                                </details>
                                {row.requires_subtype && activeCount === 0 && (
                                  <p className="mt-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-xs font-medium text-primary">
                                    This category cannot approve or rank dishes until at least one
                                    active dish type exists.
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
                {groups.length === 0 && (
                  <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                    {(cats.data ?? []).length === 0
                      ? "No categories yet."
                      : "No categories match your filter."}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="type-section-title">Areas</h3>
        <p className="mt-1 text-sm text-muted-foreground">Add areas or delete unused ones.</p>
        <div className="mt-3 space-y-2">
          <div>
            <Label>Slug *</Label>
            <Input
              value={a.slug}
              onChange={(e) => setA({ ...a, slug: e.target.value })}
              placeholder="sathorn"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, digits, hyphens only.
            </p>
          </div>
          <div>
            <Label>Name (EN) *</Label>
            <Input value={a.name_en} onChange={(e) => setA({ ...a, name_en: e.target.value })} />
          </div>
          <div>
            <Label>Name (TH) *</Label>
            <Input value={a.name_th} onChange={(e) => setA({ ...a, name_th: e.target.value })} />
          </div>
          <Button onClick={saveA} disabled={aMut.isPending}>
            Save
          </Button>
        </div>
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-muted-foreground">Existing areas</h4>
          <Input
            className="mt-2"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            placeholder={t("filter_areas")}
          />
          <div className="mt-2 divide-y divide-border rounded-lg border border-border">
            {(areas.data ?? [])
              .filter((row: any) =>
                [row.name_en, row.name_th, row.slug].some((v) =>
                  String(v).toLowerCase().includes(areaFilter.toLowerCase()),
                ),
              )
              .map((row: any) => (
                <div
                  key={row.slug}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {row.name_en} <span className="text-muted-foreground">/ {row.name_th}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{row.slug}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditing({
                          kind: "area",
                          slug: row.slug,
                          name_en: row.name_en,
                          name_th: row.name_th,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDeleting({
                          kind: "area",
                          id: row.id,
                          name_en: row.name_en,
                          slug: row.slug,
                        })
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            {(areas.data ?? []).length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">No areas yet.</p>
            )}
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
                <Input
                  value={editing.name_en}
                  onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                />
              </div>
              <div>
                <Label>Name (TH) *</Label>
                <Input
                  value={editing.name_th}
                  onChange={(e) => setEditing({ ...editing, name_th: e.target.value })}
                />
              </div>
              {editing.kind === "category" && (
                <div>
                  <Label>{t("cuisine")}</Label>
                  <Select
                    value={editing.cuisine || "none"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, cuisine: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Other" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("cuisine_other")}</SelectItem>
                      {(cuisines.data ?? [])
                        .filter((item: any) => item.slug !== "other")
                        .map((item: any) => (
                          <SelectItem key={item.slug} value={item.slug}>
                            {item.name_en}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editing.kind === "category" && (
                <div className="rounded-md border border-border bg-background p-3">
                  <Label>Reference photo</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Used only as a category example, never as a ranked dish.
                  </p>
                  {editing.reference_photo_url && (
                    <img
                      src={editing.reference_photo_url}
                      alt=""
                      className="mt-2 h-36 w-full rounded-md object-cover"
                    />
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      type="file"
                      accept={PHOTO_ACCEPT_ATTR}
                      disabled={uploadingCategoryPhoto}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await uploadCategoryPhoto(file, (url) =>
                            setEditing((current) =>
                              current ? { ...current, reference_photo_url: url } : current,
                            ),
                          );
                        }
                        e.currentTarget.value = "";
                      }}
                    />
                    {editing.reference_photo_url && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing({ ...editing, reference_photo_url: "" })}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {editing.kind === "category" && (
                <label className="flex items-start gap-2 rounded-md border border-border bg-background p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!editing.requires_subtype}
                    onChange={(e) => setEditing({ ...editing, requires_subtype: e.target.checked })}
                  />
                  <span>
                    <span className="font-semibold">Requires dish type</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Blocks approval of dishes in this category until a dish type is picked.
                    </span>
                  </span>
                </label>
              )}
              {editing.kind === "category" &&
                !editing.requires_subtype &&
                (() => {
                  const cat = (cats.data ?? []).find((c: any) => c.slug === editing.slug);
                  const activeCount = ((cat?.subtypes ?? []) as any[]).filter(
                    (s: any) => s.is_active,
                  ).length;
                  if (activeCount === 0) return null;
                  return (
                    <p className="rounded-md border border-border bg-secondary p-2 text-xs text-muted-foreground">
                      This category will remain subtype-scoped while active dish types exist.
                    </p>
                  );
                })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editMut.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.kind}</DialogTitle>
          </DialogHeader>
          {deleting && (
            <div className="space-y-3 text-sm">
              <p>
                Delete <span className="font-semibold">{deleting.name_en}</span>?
              </p>
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-5">
                This changes the public catalogue. The server blocks items that are still in use,
                but you should confirm the affected dishes and ranking pools before continuing.
              </p>
              <div>
                <Label>Type “{deleting.name_en}” to confirm</Label>
                <Input
                  className="mt-1"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending || deleteConfirmation !== deleting?.name_en}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!sub.category_id}
        onOpenChange={(o) =>
          !o && setSub({ category_id: "", slug: "", name_en: "", name_th: "", display_order: 0 })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add dish type</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Slug *</Label>
              <Input
                value={sub.slug}
                onChange={(e) => setSub({ ...sub, slug: e.target.value })}
                placeholder="tiramisu"
              />
            </div>
            <div>
              <Label>Name (EN) *</Label>
              <Input
                value={sub.name_en}
                onChange={(e) => setSub({ ...sub, name_en: e.target.value })}
              />
            </div>
            <div>
              <Label>Name (TH) *</Label>
              <Input
                value={sub.name_th}
                onChange={(e) => setSub({ ...sub, name_th: e.target.value })}
              />
            </div>
            <div>
              <Label>Display order</Label>
              <Input
                type="number"
                value={sub.display_order}
                onChange={(e) => setSub({ ...sub, display_order: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setSub({ category_id: "", slug: "", name_en: "", name_th: "", display_order: 0 })
              }
            >
              Cancel
            </Button>
            <Button onClick={saveSub} disabled={subMut.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingSubtype} onOpenChange={(o) => !o && setEditingSubtype(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit dish type</DialogTitle>
          </DialogHeader>
          {editingSubtype && (
            <div className="space-y-3">
              <div>
                <Label>Slug</Label>
                <Input value={editingSubtype.slug} readOnly disabled />
              </div>
              <div>
                <Label>Name (EN) *</Label>
                <Input
                  value={editingSubtype.name_en}
                  onChange={(e) =>
                    setEditingSubtype({ ...editingSubtype, name_en: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Name (TH) *</Label>
                <Input
                  value={editingSubtype.name_th}
                  onChange={(e) =>
                    setEditingSubtype({ ...editingSubtype, name_th: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Display order</Label>
                <Input
                  type="number"
                  value={editingSubtype.display_order ?? 0}
                  onChange={(e) =>
                    setEditingSubtype({ ...editingSubtype, display_order: Number(e.target.value) })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editingSubtype.is_active}
                  onChange={(e) =>
                    setEditingSubtype({ ...editingSubtype, is_active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubtype(null)}>
              Cancel
            </Button>
            <Button onClick={() => editSubMut.mutate()} disabled={editSubMut.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Import() {
  const [csv, setCsv] = useState(
    "category_slug,subtype_slug,area_slug,place_name,address,lat,lng,dish_name_en,dish_name_th,price_thb,photo_url,note\n",
  );
  const [placesCsv, setPlacesCsv] = useState("name,area_slug,address,lat,lng\n");
  const [autoApprove, setAutoApprove] = useState(false);
  const csvPreview = useMemo(() => previewCsv(csv), [csv]);
  const placesPreview = useMemo(() => previewCsv(placesCsv), [placesCsv]);
  const readCsvFile = (file: File | undefined, onText: (text: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result ?? "").replace(/^\uFEFF/, ""));
    reader.onerror = () => toast.error("Could not read CSV file");
    reader.readAsText(file);
  };
  const mut = useMutation({
    mutationFn: () => bulkImportCsv({ data: { csv, autoApprove } }),
    onSuccess: (r: any) =>
      toast.success(
        `Dishes: ${r.created} created, ${r.skipped ?? 0} skipped, ${r.failed ?? r.errors?.length ?? 0} failed`,
      ),
    onError: (e: any) => toast.error(e.message),
  });
  const placesMut = useMutation({
    mutationFn: () => importPlacesCsv({ data: { csv: placesCsv, autoApprove } }),
    onSuccess: (r: any) =>
      toast.success(
        `Places: ${r.created} created, ${r.skipped ?? 0} skipped, ${r.failed ?? r.errors?.length ?? 0} failed`,
      ),
    onError: (e: any) => toast.error(e.message),
  });
  const confirmAndImport = (kind: "dishes" | "places") => {
    const preview = kind === "dishes" ? csvPreview : placesPreview;
    if (!preview.valid) {
      toast.error("Fix the CSV header before importing.");
      return;
    }
    if (preview.rows === 0) {
      toast.error("The CSV has no data rows.");
      return;
    }
    const visibility = autoApprove
      ? "Valid rows will become public immediately."
      : "Valid rows will remain pending for review.";
    if (
      !window.confirm(
        `Import ${preview.rows} ${kind} row${preview.rows === 1 ? "" : "s"}?\n\n${visibility}`,
      )
    )
      return;
    if (kind === "dishes") mut.mutate();
    else placesMut.mutate();
  };
  return (
    <div className="mt-4 space-y-6">
      <div
        className={`rounded-lg border p-4 ${
          autoApprove ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-card"
        }`}
      >
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
          />
          <span>
            <span className="font-semibold">Publish valid rows immediately</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              Off by default. Leave this off to place imported rows in moderation first.
            </span>
          </span>
        </label>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="type-section-title">Import dishes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Columns:{" "}
            <code className="rounded bg-muted px-1">
              category_slug, subtype_slug, area_slug, place_name, address, lat, lng, dish_name_en,
              dish_name_th, price_thb, photo_url, note
            </code>
            . Extra export columns are ignored.
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
        <Textarea
          rows={12}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          className="font-mono text-xs"
        />
        <CsvPreview summary={csvPreview} />
        <Button
          onClick={() => confirmAndImport("dishes")}
          disabled={mut.isPending || !csvPreview.valid || csvPreview.rows === 0}
        >
          {mut.isPending
            ? "Importing..."
            : autoApprove
              ? "Import and publish dishes"
              : "Import dishes for review"}
        </Button>
        <ImportResult result={mut.data} />
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="type-section-title">Import places</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Columns:{" "}
            <code className="rounded bg-muted px-1">name, area_slug, address, lat, lng</code>. Extra
            export columns are ignored.
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
        <Textarea
          rows={10}
          value={placesCsv}
          onChange={(e) => setPlacesCsv(e.target.value)}
          className="font-mono text-xs"
        />
        <CsvPreview summary={placesPreview} />
        <Button
          onClick={() => confirmAndImport("places")}
          disabled={placesMut.isPending || !placesPreview.valid || placesPreview.rows === 0}
        >
          {placesMut.isPending
            ? "Importing..."
            : autoApprove
              ? "Import and publish places"
              : "Import places for review"}
        </Button>
        <ImportResult result={placesMut.data} />
      </section>
    </div>
  );
}

function previewCsv(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headers = (lines[0] ?? "")
    .split(",")
    .map((header) => header.trim())
    .filter(Boolean);
  return {
    rows: Math.max(0, lines.length - 1),
    columns: headers.length,
    valid: headers.length > 1 && lines.length > 0,
  };
}

function CsvPreview({ summary }: { summary: ReturnType<typeof previewCsv> }) {
  return (
    <div className="rounded-md border border-border bg-background p-3 text-xs">
      <span className="font-semibold">Preflight:</span>{" "}
      {summary.valid
        ? `${summary.rows} data row${summary.rows === 1 ? "" : "s"}, ${summary.columns} columns detected.`
        : "A valid CSV header has not been detected."}
      <span className="mt-1 block text-muted-foreground">
        The server will still validate taxonomy, duplicates, coordinates, and required fields before
        creating anything.
      </span>
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
