import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DishCard } from "@/components/DishCard";
import { listDishes, listCategories, listAreas } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { t, lang } = useI18n();
  const [cat, setCat] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();

  const dishes = useQuery({
    queryKey: ["dishes", cat, area],
    queryFn: () => listDishes({ data: { categorySlug: cat, areaSlug: area } }),
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => listAreas() });

  return (
    <AppShell>
      <h1 className="sr-only">{t("brand")}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <Pill active={!cat} onClick={() => setCat(undefined)}>
          {t("filter_all_categories")}
        </Pill>
        {(categories.data ?? []).map((c: any) => (
          <Pill key={c.id} active={cat === c.slug} onClick={() => setCat(c.slug)}>
            {lang === "th" ? c.name_th : c.name_en}
          </Pill>
        ))}
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        <Pill active={!area} onClick={() => setArea(undefined)} variant="secondary">
          {t("filter_all_areas")}
        </Pill>
        {(areas.data ?? []).map((a: any) => (
          <Pill
            key={a.id}
            active={area === a.slug}
            onClick={() => setArea(a.slug)}
            variant="secondary"
          >
            {lang === "th" ? a.name_th : a.name_en}
          </Pill>
        ))}
      </div>

      {dishes.isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : (dishes.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <h2 className="font-display text-2xl font-semibold">{t("empty_feed_title")}</h2>
          <p className="mt-2 text-muted-foreground">{t("empty_feed_body")}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to="/submit">
              <Button>{t("cta_add")}</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setCat(undefined);
                setArea(undefined);
              }}
            >
              {t("filter_all_categories")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(dishes.data ?? []).map((d: any) => (
            <DishCard key={d.id} dish={d} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Pill({
  active,
  onClick,
  children,
  variant = "primary",
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const base = "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors";
  const on =
    variant === "primary"
      ? "border-primary bg-primary text-primary-foreground"
      : "border-accent bg-accent text-accent-foreground";
  const off = "border-border bg-card text-foreground/70 hover:bg-muted";
  return (
    <button onClick={onClick} className={`${base} ${active ? on : off}`}>
      {children}
    </button>
  );
}
