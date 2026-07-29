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
  if (CUISINES.some((c) => c.value === value)) return t ? t(key) : key;
  return value || (t ? t("cuisine_other") : "Other");
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
  categories
    .filter((c) => matchesCategory(c, query))
    .forEach((category) => {
      const key = category.cuisine_ref?.name_en || category.cuisine || "other";
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
  tone = "noir",
}: {
  categories: any[];
  value?: string;
  onChange: (value: string, category: any) => void;
  lang: string;
  placeholder?: string;
  triggerLabel?: string;
  tone?: "default" | "noir";
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
        className={
          tone === "noir"
            ? "h-auto min-h-10 w-full justify-between rounded-none border-white/15 bg-white/[0.04] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-white/[0.08]"
            : "h-auto min-h-11 w-full justify-between rounded-md border-border bg-card px-3 py-2 text-left font-normal"
        }
      >
        <span
          className={
            tone === "noir"
              ? selected && !triggerLabel
                ? "text-white"
                : "text-white/75"
              : selected && !triggerLabel
                ? "text-foreground"
                : "text-muted-foreground"
          }
        >
          {triggerLabel ||
            (selected ? (lang === "th" ? selected.name_th : selected.name_en) : placeholder)}
        </span>
        <Search
          className={tone === "noir" ? "h-4 w-4 text-white/75" : "h-4 w-4 text-muted-foreground"}
        />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="inset-x-0 bottom-0 top-auto w-full max-w-none translate-x-0 translate-y-0 overflow-hidden border-white/10 bg-[#1c1b1b] p-0 text-white sm:left-1/2 sm:top-1/2 sm:max-h-[76dvh] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2">
          <DialogHeader className="border-b border-white/10 px-5 py-5 text-left">
            <p className="noir-label">{t("filter_all_categories")}</p>
            <DialogTitle className="brand-serif mt-1 text-4xl font-normal">
              {placeholder}
            </DialogTitle>
          </DialogHeader>
          <div className="border-b border-white/10 p-4">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search_categories")}
            />
          </div>
          <div className="max-h-[58dvh] overflow-y-auto p-3 sm:max-h-[50dvh]">
            {groups.map(([cuisine, items]) => (
              <div key={cuisine} className="py-2">
                <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  {lang === "th"
                    ? items[0]?.cuisine_ref?.name_th || cuisineLabel(cuisine, t)
                    : items[0]?.cuisine_ref?.name_en || cuisineLabel(cuisine, t)}
                </p>
                <div className="mt-1 grid gap-px bg-white/10 sm:grid-cols-2">
                  {items.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        onChange(category.id, category);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`min-h-16 w-full bg-[#1c1b1b] px-4 py-3 text-left text-sm transition hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring ${
                        value === category.id || value === category.slug
                          ? "bg-primary text-white"
                          : ""
                      }`}
                    >
                      <span className="font-semibold">
                        {lang === "th" ? category.name_th : category.name_en}
                      </span>
                      {lang !== "th" && category.name_th ? (
                        <span className="ml-2 font-thai text-xs text-white/75">
                          {category.name_th}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">{t("no_matching_categories")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
