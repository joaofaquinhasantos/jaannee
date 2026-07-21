import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listCategories, listDishes, submitComparison } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CategoryPicker } from "@/components/CategoryPicker";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare - JaanNee" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    dish: typeof s.dish === "string" ? s.dish : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
  }),
  component: Compare,
});

function Compare() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const search = Route.useSearch();
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const [cat, setCat] = useState<string | undefined>(search.category);
  const [subtype, setSubtype] = useState<string | undefined>();
  const selectedCat = (categories.data ?? []).find((c: any) => c.slug === cat) as any;
  const subtypes = ((selectedCat?.subtypes ?? []) as any[]).sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name_en.localeCompare(b.name_en),
  );
  const dishes = useQuery({
    queryKey: ["dishes", cat, subtype],
    queryFn: () => listDishes({ data: { categorySlug: cat, subtypeSlug: subtype } }),
    enabled: !!cat && (!subtypes.length || !!subtype),
  });

  const [aId, setAId] = useState<string | undefined>(search.dish);
  const [bId, setBId] = useState<string | undefined>();

  useEffect(() => {
    if (!cat && categories.data && categories.data.length > 0)
      setCat((categories.data[0] as any).slug);
  }, [categories.data, cat]);

  useEffect(() => {
    if (search.dish && !cat && dishes.data === undefined && categories.data) {
      listDishes({ data: {} }).then((all) => {
        const found = (all as any[]).find((d) => d.id === search.dish);
        if (found) setCat(found.category.slug);
      });
    }
  }, [search.dish, categories.data]);

  const list = (dishes.data ?? []) as any[];
  const a = useMemo(() => list.find((d) => d.id === aId), [list, aId]);
  const b = useMemo(() => list.find((d) => d.id === bId), [list, bId]);

  const mut = useMutation({
    mutationFn: async (winnerId: string) => {
      if (!authed) {
        toast.error("Sign in to save your vote");
        nav({ to: "/auth" });
        return { ok: false };
      }
      return submitComparison({ data: { dishAId: a!.id, dishBId: b!.id, winnerId } });
    },
    onSuccess: (res: any) => {
      if (res?.ok === false) return;
      toast.success(t("comparison_saved"));
      setAId(undefined);
      setBId(undefined);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell>
      <section className="border-b border-border pb-4 md:pb-7">
        <p className="text-xs font-bold uppercase text-primary">Head to head</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl leading-none md:text-7xl">{t("nav_compare")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:mt-3 md:text-base md:leading-7">
              Tap the better dish. Sign in only when your vote needs saving.
            </p>
          </div>
          {!authed && (
            <Link to="/auth">
              <Button size="sm" variant="outline">{t("sign_in")}</Button>
            </Link>
          )}
        </div>
      </section>

      <div className="mt-6 max-w-sm">
        <CategoryPicker
          categories={categories.data ?? []}
          value={cat}
          lang={lang}
          placeholder={t("choose_category")}
          onChange={(_, category) => {
            setCat(category.slug);
            setSubtype(undefined);
            setAId(undefined);
            setBId(undefined);
          }}
        />
      </div>
      {subtypes.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {subtypes.map((s: any) => (
            <button
              key={s.id}
              onClick={() => {
                setSubtype(s.slug);
                setAId(undefined);
                setBId(undefined);
              }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${subtype === s.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {lang === "th" ? s.name_th : s.name_en}
            </button>
          ))}
        </div>
      )}

      {cat && subtypes.length > 0 && !subtype ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-3xl">Choose a dish type first.</h2>
          <p className="mt-2 text-muted-foreground">Comparisons only happen inside the same actual dish.</p>
        </div>
      ) : cat &&
        (list.length < 2 && !dishes.isLoading ? (
          <div className="mt-6 rounded-lg border border-border bg-card p-6">
            <h2 className="font-display text-3xl">Not enough dishes yet.</h2>
            <p className="mt-2 text-muted-foreground">{t("compare_empty")}</p>
            <Link to="/submit">
              <Button className="mt-5">{t("cta_add")}</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <DishPicker
              label="Dish A"
              value={aId}
              onChange={setAId}
              options={list.filter((d) => d.id !== bId)}
              lang={lang}
            />
            <DishPicker
              label="Dish B"
              value={bId}
              onChange={setBId}
              options={list.filter((d) => d.id !== aId)}
              lang={lang}
            />
          </div>
        ))}

      {a && b && (
        <div className="mt-8">
          <p className="text-center text-sm font-semibold uppercase text-muted-foreground">{t("which_better")}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <WinnerCard dish={a} onPick={() => mut.mutate(a.id)} disabled={mut.isPending} />
            <WinnerCard dish={b} onPick={() => mut.mutate(b.id)} disabled={mut.isPending} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

function PreviewTile({ label }: { label: string }) {
  return (
    <div className="aspect-[4/5] rounded-lg border border-border bg-card p-3">
      <div className="h-full rounded-md border border-dashed border-border" />
      <p className="mt-2 text-center text-xs font-bold uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function DishPicker({
  label,
  value,
  onChange,
  options,
  lang,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  options: any[];
  lang: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("pick_dish")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {(lang === "th" && d.name_th) || d.name_en} - {d.place?.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function WinnerCard({
  dish,
  onPick,
  disabled,
}: {
  dish: any;
  onPick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className="group overflow-hidden rounded-lg border border-border bg-card text-left shadow-[0_18px_45px_rgba(42,30,36,0.06)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_22px_60px_rgba(42,30,36,0.1)] disabled:opacity-60"
    >
      <div className="aspect-[4/3] bg-muted">
        {dish.photo_url ? (
          <img src={dish.photo_url} alt={dish.name_en} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary font-display text-4xl italic text-muted-foreground">JaanNee</div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-2xl leading-none">{dish.name_en}</h3>
        {dish.name_th ? <p className="mt-1 font-thai text-sm font-medium text-muted-foreground">{dish.name_th}</p> : null}
        <p className="mt-2 text-sm text-muted-foreground">{dish.place?.name}</p>
      </div>
    </button>
  );
}
