import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { amIAdmin } from "@/lib/admin.functions";
import { BarChart3, Home, Plus, ShieldCheck, UserRound } from "lucide-react";
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
  const desktopNav = [
    { to: "/", label: t("nav_feed"), Icon: Home },
    { to: "/rankings", label: t("nav_rankings"), Icon: BarChart3 },
    ...(isAdmin ? [{ to: "/admin", label: t("nav_admin"), Icon: ShieldCheck }] : []),
  ];
  const mobileSideNav = [
    { to: "/", label: t("nav_feed"), Icon: Home },
    { to: "/rankings", label: t("nav_rankings"), Icon: BarChart3 },
  ];

  return (
    <div
      className={
        noir
          ? "noir-theme min-h-screen bg-background text-foreground"
          : "min-h-screen bg-background text-foreground"
      }
    >
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 flex-col border-r border-white/10 bg-[#0e0e0e] px-5 py-9 shadow-2xl md:flex">
        <Link to="/" className="flex items-center gap-3 px-3">
          <span className="h-9 w-1.5 bg-primary" aria-hidden="true" />
          <span className="brand-serif text-4xl leading-none text-[#faf8f4]">{t("brand")}</span>
        </Link>
        <p className="mt-4 px-3 text-[10px] font-bold uppercase leading-5 tracking-[0.15em] text-white/35">
          {t("tagline")}
        </p>
        <nav className="mt-12 flex flex-1 flex-col gap-1">
          {desktopNav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`flex min-h-14 items-center gap-4 border-l-2 px-5 text-[11px] font-bold uppercase tracking-[0.16em] transition ${
                path === n.to
                  ? "border-primary bg-white/[0.06] text-primary"
                  : "border-transparent text-white/45 hover:bg-white/[0.03] hover:text-white"
              }`}
            >
              <n.Icon className="h-5 w-5" aria-hidden="true" />
              {n.label}
            </Link>
          ))}
          <Link
            to="/submit"
            className="mt-7 flex min-h-14 items-center justify-between bg-primary px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#ef4934]"
          >
            {t("nav_submit")}
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Link>
        </nav>
        <Link
          to={auth.status === "in" ? "/profile" : "/auth"}
          className="flex min-h-14 items-center gap-4 border-t border-white/10 px-4 pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55 hover:text-primary"
        >
          <UserRound className="h-5 w-5" aria-hidden="true" />
          {auth.status === "in" ? t("nav_profile") : t("sign_in")}
        </Link>
      </aside>
      <header
        className={`sticky top-0 z-40 backdrop-blur-xl md:ml-72 ${noir ? "border-b border-white/10 bg-[#131313]/90" : "border-b-2 border-foreground bg-background/95"}`}
      >
        <div
          className={`mx-auto flex min-h-16 items-center justify-between ${noir ? "max-w-[112rem] px-5 py-3 md:px-8" : "max-w-[90rem] px-4 py-2.5 md:px-8 md:py-3"}`}
        >
          <Link to="/" className="flex items-baseline gap-3 focus-visible:rounded-md md:hidden">
            <span
              className={`brand-serif text-3xl leading-none md:text-[2.6rem] ${noir ? "text-[#faf8f4]" : "text-foreground"}`}
            >
              {t("brand")}
            </span>
            <span
              className={`hidden max-w-44 border-l pl-3 text-[10px] font-bold uppercase leading-tight tracking-[0.12em] sm:inline ${noir ? "border-white/20 text-white/45" : "border-foreground/25 text-muted-foreground"}`}
            >
              {t("tagline")}
            </span>
          </Link>
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.22em] text-white/35 md:block">
            {path === "/" ? t("nav_feed") : path.startsWith("/rankings") ? t("nav_rankings") : t("brand")}
          </p>
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
                  className={`gap-2 rounded-none text-xs font-bold uppercase tracking-[0.08em] ${noir ? "border-white/20 bg-transparent text-white hover:border-primary hover:bg-primary hover:text-white" : "border-foreground/25 bg-card"}`}
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
            ? "pb-24 md:ml-72 md:w-[calc(100%-18rem)] md:pb-0"
            : `mx-auto max-w-[90rem] px-4 pb-24 pt-4 md:ml-72 md:w-[calc(100%-18rem)] md:max-w-none md:px-8 md:pt-8 ${noir ? "min-h-[calc(100vh-8rem)]" : ""}`
        }
      >
        {children}
      </main>
      <footer
        className={
          noir
            ? "border-t border-white/10 bg-[#101010] py-7 pb-28 md:ml-72 md:py-8 md:pb-8"
            : "border-t-2 border-foreground bg-card py-8 pb-28 md:ml-72 md:py-10 md:pb-8"
        }
      >
        <div
          className={`mx-auto flex items-center justify-between px-4 md:px-8 ${noir ? "max-w-[112rem]" : "max-w-[90rem]"}`}
        >
          <div>
            <p className="brand-serif text-2xl text-[#faf8f4]">JaanNee</p>
            <p className="mt-1 hidden text-[10px] font-bold uppercase tracking-[0.16em] text-white/35 sm:block">
              {t("tagline")}
            </p>
          </div>
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
        className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl md:hidden ${noir ? "bg-[#131313]/92" : "border-border bg-background/95"}`}
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end rounded-full border border-white/10 bg-[#1c1b1b]/95 px-2 py-1.5 shadow-2xl">
          {mobileSideNav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-[0.05em] transition-colors ${
                path === n.to
                  ? noir
                    ? "text-primary"
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
          <Link
            to="/submit"
            aria-label={t("nav_submit")}
            className="-mt-5 flex h-14 w-14 place-self-center items-center justify-center rounded-full border-4 border-[#131313] bg-primary text-white shadow-2xl transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </Link>
          <Link
            to={auth.status === "in" ? "/profile" : "/auth"}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-[0.05em] ${
              path === "/profile" ? "text-primary" : "text-white/45"
            }`}
          >
            <UserRound className="h-5 w-5" aria-hidden="true" />
            {t("nav_profile")}
          </Link>
          {isAdmin ? (
            <Link
              to="/admin"
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-[0.05em] ${
                path === "/admin" ? "text-primary" : "text-white/45"
              }`}
            >
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              {t("nav_admin")}
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </nav>
    </div>
  );
}
