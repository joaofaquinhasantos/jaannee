import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { myProfile } from "@/lib/dishes.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { DishCard } from "@/components/DishCard";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/profile")({ component: Profile });

function Profile() {
  const { t } = useI18n();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["profile"], queryFn: () => myProfile() });
  const tried = (q.data?.tried ?? []).map((r: any) => r.dish).filter(Boolean);
  const compared = q.data?.compared ?? [];

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/", replace: true });
  };

  return (
    <AppShell>
      <div className="flex items-start justify-between">
        <h1 className="font-display text-3xl font-semibold">{t("nav_profile")}</h1>
        <Button variant="ghost" onClick={signOut}>{t("sign_out")}</Button>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-xl font-semibold">Tried</h2>
        {tried.length === 0 ? <p className="text-muted-foreground text-sm">Nothing yet.</p> : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tried.map((d: any) => <DishCard key={d.id} dish={d} />)}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl font-semibold">Comparisons</h2>
        {compared.length === 0 ? <p className="text-muted-foreground text-sm">No comparisons yet. <Link to="/compare" className="text-primary underline">Compare two dishes</Link>.</p> : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {compared.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                <span className={c.winner_id === c.lo?.id ? "font-medium" : "text-muted-foreground"}>{c.lo?.name_en} <span className="text-xs text-muted-foreground">({c.lo?.place?.name})</span></span>
                <span className="text-muted-foreground">vs</span>
                <span className={c.winner_id === c.hi?.id ? "font-medium" : "text-muted-foreground"}>{c.hi?.name_en} <span className="text-xs text-muted-foreground">({c.hi?.place?.name})</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}