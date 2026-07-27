import { CategoryPicker } from "@/components/CategoryPicker";
import { AreaPicker } from "@/components/AreaPicker";
import { useI18n } from "@/lib/i18n";

type DishBrowserProps = {
  categories: any[];
  areas: any[];
  category?: string;
  subtype?: string;
  area?: string;
  onCategoryChange: (slug: string | undefined) => void;
  onSubtypeChange: (slug: string | undefined) => void;
  onAreaChange: (slug: string | undefined) => void;
};

export function DishBrowser({
  categories,
  areas,
  category,
  subtype,
  area,
  onCategoryChange,
  onSubtypeChange,
  onAreaChange,
}: DishBrowserProps) {
  const { t, lang } = useI18n();
  const selectedCategory = categories.find((item) => item.slug === category);
  const activeSubtypes = [...(selectedCategory?.subtypes ?? [])]
    .filter((item) => item.is_active)
    .sort(
      (a, b) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        a.name_en.localeCompare(b.name_en),
    );
  const scoped =
    Boolean(selectedCategory?.requires_subtype) || activeSubtypes.length > 0;
  const hasFilters = Boolean(category || area);

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <CategoryPicker
          categories={categories}
          value={category}
          lang={lang}
          placeholder={t("filter_all_categories")}
          onChange={(_, item) => {
            onCategoryChange(item.slug);
            onSubtypeChange(undefined);
          }}
        />
        <AreaPicker
          areas={areas}
          value={area}
          lang={lang}
          onChange={(slug) => onAreaChange(slug)}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              onCategoryChange(undefined);
              onSubtypeChange(undefined);
              onAreaChange(undefined);
            }}
            className="px-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            Reset
          </button>
        )}
      </div>

      {category && scoped && activeSubtypes.length > 0 && (
        <div className="mt-3 flex gap-5 overflow-x-auto">
          {activeSubtypes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSubtypeChange(item.slug)}
              className={`shrink-0 border-b py-2 text-sm font-semibold transition-colors ${
                subtype === item.slug
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "th" ? item.name_th : item.name_en}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
