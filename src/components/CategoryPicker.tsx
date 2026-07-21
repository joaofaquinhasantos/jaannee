import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n, type Key } from "@/lib/i18n";

export const CUISINES = [
  { value: "thai", labelKey: "cuisine_thai" },
  { value: "italian", labelKey: "cuisine_italian" },
  { value: "japanese", labelKey: "cuisine_japanese" },
  { value: "western", labelKey: "cuisine_western" },
  { value: "dessert-cafe", labelKey: "cuisine_dessert_cafe" },
  { value: "other", labelKey: "cuisine_other" },
];

export function cuisineLabel(value?: string | null, t?: (key: Key) => string) {
  const key = (CUISINES.find((c) => c.value === value)?.labelKey ?? "cuisine_other") as Key;
  return t ? t(key) : key;
}

function matchesCategory(category: any, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [category.name_en, category.name_th, category.slug]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

export function groupedCategories(categories: any[], query = "") {
  const groups = new Map<string, any[]>();
  categories.filter((c) => matchesCategory(c, query)).forEach((category) => {
    const key = category.cuisine || "other";
    groups.set(key, [...(groups.get(key) ?? []), category]);
  });
  return [...groups.entries()].sort(([a], [b]) => cuisineLabel(a).localeCompare(cuisineLabel(b)));
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  lang,
  placeholder = "Choose category",
  triggerLabel,
}: {
  categories: any[];
  value?: string;
  onChange: (value: string, category: any) => void;
  lang: string;
  placeholder?: string;
  triggerLabel?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = categories.find((c) => c.id === value || c.slug === value);
  const groups = useMemo(() => groupedCategories(categories, query), [categories, query]);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-auto min-h-11 w-full justify-between rounded-md border-border bg-card px-3 py-2 text-left font-normal"
      >
        <span className={selected && !triggerLabel ? "text-foreground" : "text-muted-foreground"}>
          {triggerLabel || (selected ? (lang === "th" ? selected.name_th : selected.name_en) : placeholder)}
        </span>
        <Search className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-4 py-4">
            <DialogTitle>{placeholder}</DialogTitle>
          </DialogHeader>
          <div className="border-b border-border p-4">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search_categories")}
            />
          </div>
          <div className="max-h-[60dvh] overflow-y-auto p-2">
            {groups.map(([cuisine, items]) => (
              <div key={cuisine} className="py-2">
                <p className="px-2 text-xs font-bold uppercase text-muted-foreground">{cuisineLabel(cuisine, t)}</p>
                <div className="mt-1 space-y-1">
                  {items.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        onChange(category.id, category);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <span className="font-semibold">{lang === "th" ? category.name_th : category.name_en}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{category.slug}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("no_matching_categories")}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
