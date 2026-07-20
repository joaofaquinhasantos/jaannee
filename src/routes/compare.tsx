import { createFileRoute, Link } from "@tanstack/react-router";
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

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare — JaanNee" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    dish: typeof s.dish === "string" ? s.dish : undefined,
  }),
  component: Compare,
});

function Compare() {
  const { t, lang } = useI18n();
  const search = Route.useSearch();
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const [cat, setCat] = useState<string | undefined>();
  const dishes = useQuery({
    queryKey: ["dishes", cat],
    queryFn: () => listDishes({ data: { categorySlug: cat } }),
    enabled: !!cat,
  });

  const [aId, setAId] = useState<string | undefined>(search.dish);
  const [bId, setBId] = useState<string | undefined>();

  // If preselected dish, derive its category
  useEffect(() => {
    if (search.dish && !cat && dishes.data === undefined && categories.data) {
      // fetch all and find category
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
    mutationFn: (winnerId: string) =>
      submitComparison({ data: { dishAId: a!.id, dishBId: b!.id, winnerId } }),
    onSuccess: () => {
      toast.success(t("comparison_saved"));
      setAId(undefined);
      setBId(undefined);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!authed)
    return (
      <AppShell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display text-3xl font-semibold">{t("nav_compare")}</h1>
          <p className="mt-2 text-muted-foreground">{t("sign_in_compare")}</p>
          <Link to="/auth">
            <Button className="mt-4">{t("sign_in")}</Button>
          </Link>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">{t("nav_compare")}</h1>
      <p className="mt-2 text-muted-foreground">{t("compare_intro")}</p>

      <div className="mt-6 max-w-sm">
        <Select
          value={cat}
          onValueChange={(v) => {
            setCat(v);
            setAId(undefined);
            setBId(undefined);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("choose_category")} />
          </SelectTrigger>
          <SelectContent>
            {(categories.data ?? []).map((c: any) => (
              <SelectItem key={c.id} value={c.slug}>
                {lang === "th" ? c.name_th : c.name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cat &&
        (list.length < 2 && !dishes.isLoading ? (
          <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-6 text-center text-muted-foreground">
            {t("compare_empty")}
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
          <p className="text-center text-sm text-muted-foreground">{t("which_better")}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <WinnerCard dish={a} onPick={() => mut.mutate(a.id)} disabled={mut.isPending} />
            <WinnerCard dish={b} onPick={() => mut.mutate(b.id)} disabled={mut.isPending} />
          </div>
        </div>
      )}
    </AppShell>
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
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("pick_dish")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {(lang === "th" && d.name_th) || d.name_en} — {d.place?.name}
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
      className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg disabled:opacity-60"
    >
      <div className="aspect-[4/3] bg-muted">
        {dish.photo_url ? (
          <img src={dish.photo_url} alt={dish.name_en} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🍜</div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-xl font-semibold">{dish.name_en}</h3>
        <p className="text-sm text-muted-foreground">{dish.place?.name}</p>
      </div>
    </button>
  );
}
