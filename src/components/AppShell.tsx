import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { amIAdmin } from "@/lib/admin.functions";
import { BarChart3, Home, PlusCircle, Swords, ShieldCheck } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setEmail(s?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const adminQ = useQuery({
    queryKey: ["is-admin", email],
    queryFn: () => amIAdmin(),
    enabled: !!email,
  });
  const isAdmin = !!adminQ.data?.admin;

  const nav = [
    { to: "/", label: t("nav_feed"), Icon: Home },
    { to: "/rankings", label: t("nav_rankings"), Icon: BarChart3 },
    { to: "/compare", label: t("nav_compare"), Icon: Swords },
    { to: "/submit", label: t("nav_submit"), Icon: PlusCircle },
    ...(isAdmin ? [{ to: "/admin", label: t("nav_admin"), Icon: ShieldCheck }] : []),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between px-4 py-2.5 md:px-8 md:py-3">
          <Link to="/" className="flex items-baseline gap-3 focus-visible:rounded-md">
            <span className="font-display text-3xl leading-none tracking-[-0.04em] text-foreground md:text-4xl">
              {t("brand")}
            </span>
            <span className="hidden max-w-44 border-l border-foreground/25 pl-3 text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-muted-foreground sm:inline">{t("tagline")}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                  path === n.to
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "th" : "en")}
              className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-primary"
              aria-label="Toggle language"
            >
              {lang === "en" ? "TH" : "EN"}
            </button>
            {email ? (
              <Link to="/profile">
                <Button variant="ghost" size="sm">
                  {t("nav_profile")}
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button size="sm">{t("sign_in")}</Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[90rem] px-4 pb-24 pt-4 md:px-8 md:pt-8">{children}</main>
      <footer className="border-t-2 border-foreground bg-card py-8 pb-28 md:py-10 md:pb-8">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between px-4 md:px-8">
          <p className="font-display text-2xl">JaanNee</p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} JaanNee
          </p>
        </div>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-2">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-center text-[11px] font-semibold transition-colors ${
                path === n.to ? "bg-secondary text-primary" : "text-muted-foreground"
              }`}
            >
              <n.Icon className="h-5 w-5" aria-hidden="true" />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
