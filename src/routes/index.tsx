import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DishCard } from "@/components/DishCard";
import { listDishes, listCategories, listAreas } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

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
      <section className="border-b border-border pb-8 md:grid md:grid-cols-[1.1fr_0.9fr] md:gap-10 md:pb-12">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Bangkok dish board</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[0.95] text-foreground md:text-7xl">
            Bangkok's dishes, ranked one bite at a time.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
            Vote dish against dish, not restaurant against restaurant. Find the plate worth crossing town for.
          </p>
          <p className="mt-3 font-thai text-lg font-medium text-foreground/80">
            จานไหนดี ให้คนกินช่วยตัดสิน
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/compare">
              <Button>{t("cta_compare")}</Button>
            </Link>
            <Link to="/submit">
              <Button variant="outline">{t("cta_add")}</Button>
            </Link>
          </div>
          <div className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <TrustSignal text="No restaurant ads" />
            <TrustSignal text="Dish vs dish only" />
            <TrustSignal text="Ranked by local comparisons" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3 md:mt-0">
          {["01", "02", "03"].map((n, i) => (
            <div key={n} className={`rounded-lg border border-border bg-card p-4 ${i === 1 ? "mt-8" : ""}`}>
              <span className="font-display text-5xl leading-none text-accent">{n}</span>
              <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">
                {i === 0 ? "Nominate" : i === 1 ? "Compare" : "Rank"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">Browse the board</p>
            <h2 className="mt-1 font-display text-3xl">Discover</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start here: pick a category, add a missing dish, or compare two plates.
            </p>
          </div>
          {(cat || area) && (
            <button
              onClick={() => {
                setCat(undefined);
                setArea(undefined);
              }}
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          <Pill active={!cat} onClick={() => setCat(undefined)}>
            {t("filter_all_categories")}
          </Pill>
          {(categories.data ?? []).map((c: any) => (
            <Pill key={c.id} active={cat === c.slug} onClick={() => setCat(c.slug)}>
              {lang === "th" ? c.name_th : c.name_en}
            </Pill>
          ))}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          <Pill active={!area} onClick={() => setArea(undefined)} variant="secondary">
            {t("filter_all_areas")}
          </Pill>
          {(areas.data ?? []).map((a: any) => (
            <Pill key={a.id} active={area === a.slug} onClick={() => setArea(a.slug)} variant="secondary">
              {lang === "th" ? a.name_th : a.name_en}
            </Pill>
          ))}
        </div>
      </section>

      <section className="mt-6">
        {dishes.isLoading ? (
          <p className="text-muted-foreground">{t("loading")}</p>
        ) : (dishes.data ?? []).length === 0 ? (
          <EditorialEmpty
            title="The board is hungry."
            body="No dishes match this view yet. Add the first plate, then let comparisons sort out the legend from the tourist trap."
            primary={t("cta_add")}
            secondary={t("filter_all_categories")}
            onSecondary={() => {
              setCat(undefined);
              setArea(undefined);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(dishes.data ?? []).map((d: any) => (
              <DishCard key={d.id} dish={d} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function TrustSignal({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 font-semibold">
      {text}
    </div>
  );
}

function EditorialEmpty({
  title,
  body,
  primary,
  secondary,
  onSecondary,
}: {
  title: string;
  body: string;
  primary: string;
  secondary: string;
  onSecondary: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid md:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-border bg-secondary p-6 md:border-b-0 md:border-r">
          <span className="font-display text-7xl leading-none text-accent">00</span>
          <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">No verdict yet</p>
        </div>
        <div className="p-6 md:p-8">
          <h2 className="font-display text-4xl leading-tight">{title}</h2>
          <p className="mt-3 max-w-lg leading-7 text-muted-foreground">{body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/submit">
              <Button>{primary}</Button>
            </Link>
            <Button variant="outline" onClick={onSecondary}>{secondary}</Button>
          </div>
        </div>
      </div>
    </div>
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
  const base = "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors";
  const on =
    variant === "primary"
      ? "border-primary bg-primary text-primary-foreground"
      : "border-accent bg-accent text-accent-foreground";
  const off = "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground";
  return (
    <button onClick={onClick} className={`${base} ${active ? on : off}`}>
      {children}
    </button>
  );
}
