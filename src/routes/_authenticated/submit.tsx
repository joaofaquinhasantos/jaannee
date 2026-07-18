import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listCategories, listAreas, searchSimilar, submitDish } from "@/lib/dishes.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [price_thb, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dup, setDup] = useState<{ places: any[]; dishes: any[] } | null>(null);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name_en || !place_name || !category_id || !area_id) { toast.error("Fill required fields"); return; }
    const res = await searchSimilar({ data: { placeName: place_name, dishName: name_en } });
    if ((res.places?.length ?? 0) + (res.dishes?.length ?? 0) > 0) { setDup(res); setStep("dup"); }
    else await doSubmit();
  };

  const doSubmit = async () => {
    try {
      await submitDish({ data: {
        name_en, name_th: name_th || undefined,
        place_name, area_id, address: address || undefined,
        category_id, price_thb: price_thb ? Number(price_thb) : undefined,
        photo_url: photoUrl || undefined, note: note || undefined,
      }});
      setStep("done");
    } catch (e: any) { toast.error(e.message); }
  };

  const onFile = async (f: File) => {
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setUploading(false); return; }
    const path = `${u.user.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("dish-photos").upload(path, f, { upsert: false });
    if (error) { toast.error(error.message); setUploading(false); return; }
    // Bucket is private; serve through the public /photos/* proxy route.
    setPhotoUrl(`/photos/${path}`);
    setUploading(false);
  };

  if (step === "done") return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-2xl font-semibold">Submitted — thank you</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your dish is pending review. It'll appear once approved.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => nav({ to: "/" })}>Back to feed</Button>
          <Button variant="outline" onClick={() => { setStep("form"); setNameEn(""); setNameTh(""); setPlaceName(""); setPrice(""); setNote(""); setPhotoUrl(""); }}>Add another</Button>
        </div>
      </div>
    </AppShell>
  );

  if (step === "dup" && dup) return (
    <AppShell>
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl font-semibold">Is this one of these?</h1>
        <p className="mt-1 text-sm text-muted-foreground">We found similar entries. Please check before adding.</p>
        <div className="mt-4 space-y-3">
          {dup.dishes.map((d) => (
            <div key={d.id} className="rounded-xl border border-border bg-card p-3 text-sm">
              <span className="font-medium">{d.name_en}</span> — {d.place?.name}
            </div>
          ))}
          {dup.places.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-3 text-sm">
              📍 {p.name}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setStep("form")}>Back to edit</Button>
          <Button onClick={doSubmit}>None of these — submit anyway</Button>
        </div>
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-semibold">{t("nav_submit")}</h1>
        <form onSubmit={check} className="mt-6 space-y-4">
          <div>
            <Label>Photo</Label>
            <div className="mt-1 flex items-center gap-3">
              {photoUrl && <img src={photoUrl} className="h-16 w-16 rounded-lg object-cover" alt="preview" />}
              <input type="file" accept="image/*" onChange={(e) => e.target.files && onFile(e.target.files[0])} disabled={uploading}
                className="text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Dish name (EN) *</Label><Input value={name_en} onChange={(e) => setNameEn(e.target.value)} required maxLength={120} /></div>
            <div><Label>ชื่อจาน (TH)</Label><Input value={name_th} onChange={(e) => setNameTh(e.target.value)} maxLength={120} /></div>
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={category_id} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{lang === "th" ? c.name_th : c.name_en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Restaurant / stall name *</Label><Input value={place_name} onChange={(e) => setPlaceName(e.target.value)} required maxLength={160} /></div>
          <div>
            <Label>Area *</Label>
            <Select value={area_id} onValueChange={setAreaId}>
              <SelectTrigger><SelectValue placeholder="Choose area" /></SelectTrigger>
              <SelectContent>
                {(areas.data ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{lang === "th" ? a.name_th : a.name_en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Address (optional)</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} /></div>
          <div><Label>Price (THB)</Label><Input type="number" value={price_thb} onChange={(e) => setPrice(e.target.value)} min={0} max={100000} /></div>
          <div><Label>Note (optional)</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></div>
          <Button type="submit" className="w-full">Submit for review</Button>
        </form>
      </div>
    </AppShell>
  );
}