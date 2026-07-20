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
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tracking-tight text-primary">
              {t("brand")}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">{t("tagline")}</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  path === n.to
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "th" : "en")}
              className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
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
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:pt-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-2">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-center text-[11px] font-medium ${
                path === n.to ? "text-primary" : "text-foreground/60"
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
