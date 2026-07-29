import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { amIAdmin } from "@/lib/admin.functions";
import { BarChart3, Home, PlusCircle, ShieldCheck, UserRound } from "lucide-react";
import { useAuthUser } from "@/lib/use-auth";

export function AppShell({
  children,
  tone = "noir",
  fullBleed = false,
}: {
  children: React.ReactNode;
  tone?: "default" | "noir";
  fullBleed?: boolean;
}) {
  const { t, lang, setLang } = useI18n();
  const auth = useAuthUser();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const adminQ = useQuery({
    queryKey: ["is-admin", auth.userId],
    queryFn: () => amIAdmin(),
    enabled: auth.status === "in",
  });
  const isAdmin = !!adminQ.data?.admin;
  const noir = tone === "noir";

  // Compare is deliberately NOT a primary destination. Comparisons are
  // reached contextually (My Dishes, Dish Detail, the tried drawer and
  // challenge links), never from a generic nav entry.
  const nav = [
    { to: "/", label: t("nav_feed"), Icon: Home },
    { to: "/rankings", label: t("nav_rankings"), Icon: BarChart3 },
    { to: "/submit", label: t("nav_submit"), Icon: PlusCircle },
    ...(isAdmin ? [{ to: "/admin", label: t("nav_admin"), Icon: ShieldCheck }] : []),
  ];

  return (
    <div
      className={
        noir
          ? "noir-theme min-h-screen bg-background text-foreground"
          : "min-h-screen bg-background text-foreground"
      }
    >
      <header
        className={`sticky top-0 z-40 backdrop-blur ${noir ? "border-b border-white/10 bg-[#111111]/95" : "border-b-2 border-foreground bg-background/95"}`}
      >
        <div
          className={`mx-auto flex items-center justify-between ${noir ? "max-w-[112rem] px-5 py-3 md:px-8" : "max-w-[90rem] px-4 py-2.5 md:px-8 md:py-3"}`}
        >
          <Link to="/" className="flex items-baseline gap-3 focus-visible:rounded-md">
            <span
              className={`brand-serif text-3xl leading-none md:text-4xl ${noir ? "text-white" : "text-foreground"}`}
            >
              {t("brand")}
            </span>
            <span
              className={`hidden max-w-44 border-l pl-3 text-[10px] font-bold uppercase leading-tight tracking-[0.12em] sm:inline ${noir ? "border-white/20 text-white/45" : "border-foreground/25 text-muted-foreground"}`}
            >
              {t("tagline")}
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                  path === n.to
                    ? "border-primary text-primary"
                    : noir
                      ? "border-transparent text-white/50 hover:border-white/25 hover:text-white"
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
              className={`rounded-none border px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors ${noir ? "border-white/20 bg-transparent text-white hover:border-primary hover:text-primary" : "border-border bg-card text-foreground hover:border-primary/30 hover:text-primary"}`}
              aria-label="Toggle language"
            >
              {lang === "en" ? "TH" : "EN"}
            </button>
            {auth.status === "in" ? (
              <Link to="/profile">
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-2 rounded-none text-xs font-bold uppercase tracking-[0.08em] ${noir ? "border-white/20 bg-transparent text-white hover:bg-white hover:text-black" : "border-foreground/25 bg-card"}`}
                >
                  <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("nav_profile")}
                </Button>
              </Link>
            ) : auth.status === "out" ? (
              <Link to="/auth">
                <Button size="sm">{t("sign_in")}</Button>
              </Link>
            ) : (
              <span className="h-9 w-20 animate-pulse bg-white/10" aria-label={t("loading")} />
            )}
          </div>
        </div>
      </header>
      <main
        className={
          fullBleed
            ? "mx-auto max-w-[112rem] pb-24 md:pb-0"
            : `mx-auto max-w-[90rem] px-4 pb-24 pt-4 md:px-8 md:pt-8 ${noir ? "min-h-[calc(100vh-8rem)]" : ""}`
        }
      >
        {children}
      </main>
      <footer
        className={
          noir
            ? "border-t border-white/10 bg-[#111111] py-8 pb-28 md:py-10 md:pb-8"
            : "border-t-2 border-foreground bg-card py-8 pb-28 md:py-10 md:pb-8"
        }
      >
        <div
          className={`mx-auto flex items-center justify-between px-4 md:px-8 ${noir ? "max-w-[112rem]" : "max-w-[90rem]"}`}
        >
          <p className="brand-serif text-2xl">JaanNee</p>
          <div className="flex items-center gap-4">
            <Link
              to={auth.status === "in" ? "/restaurant" : "/auth"}
              search={auth.status === "out" ? { redirect: "/restaurant" } : undefined}
              className={
                noir
                  ? "text-xs font-semibold text-white/45 hover:text-primary"
                  : "text-xs font-semibold text-muted-foreground hover:text-primary"
              }
            >
              {lang === "th" ? "สำหรับร้านอาหาร" : "For restaurants"}
            </Link>
            <p className={noir ? "text-sm text-white/35" : "text-sm text-muted-foreground"}>
              © {new Date().getFullYear()} JaanNee
            </p>
          </div>
        </div>
      </footer>
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden ${noir ? "border-white/10 bg-[#111111]/95" : "border-border bg-background/95"}`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-2">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-center text-[11px] font-semibold transition-colors ${
                path === n.to
                  ? noir
                    ? "bg-white/10 text-primary"
                    : "bg-secondary text-primary"
                  : noir
                    ? "text-white/45"
                    : "text-muted-foreground"
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
