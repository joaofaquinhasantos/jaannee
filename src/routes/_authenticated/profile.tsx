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
  const posted = q.data?.posted ?? [];
  const profile = q.data?.profile;
  const displayName = profile?.display_name || profile?.username || "Your profile";

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/", replace: true });
  };

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5 md:pb-7">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Your taste trail</p>
          <h1 className="mt-2 font-display text-4xl leading-none md:text-5xl">{displayName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your posts, tried dishes, and voting history.</p>
        </div>
        <Button variant="ghost" onClick={signOut}>{t("sign_out")}</Button>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 rounded-lg border border-border bg-card p-3 text-center">
        <Stat label="Posts" value={posted.length} />
        <Stat label="Tried" value={tried.length} />
        <Stat label="Votes" value={compared.length} />
        <Stat label="Followers" value={q.data?.followers_count ?? 0} />
      </div>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-3xl">Posted</h2>
        {posted.length === 0 ? <EmptyNote text="No posts yet." /> : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posted.map((d: any) => <DishCard key={d.id} dish={d} />)}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-3xl">Tried</h2>
        {tried.length === 0 ? <EmptyNote text="No dishes marked tried yet." /> : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tried.map((d: any) => <DishCard key={d.id} dish={d} />)}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-3xl">Comparisons</h2>
        {compared.length === 0 ? <EmptyNote text="No comparisons yet." link /> : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-2xl leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyNote({ text, link }: { text: string; link?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
      {text} {link ? <Link to="/compare" className="font-semibold text-primary underline-offset-4 hover:underline">Compare two dishes</Link> : null}
    </div>
  );
}
