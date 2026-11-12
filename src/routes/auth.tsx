import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { StitchSocialShell } from "@/components/StitchSocialShell";
import { HeartHandshake, Mail, ShieldCheck, Store, Utensils } from "lucide-react";
import "./auth.css";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  head: () => ({
    meta: [
      { title: "Sign in — JaanNee" },
      {
        name: "description",
        content:
          "Sign in to JaanNee with a magic link or Google to add dishes, mark what you have tried, and compare dishes head-to-head.",
      },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Sign in — JaanNee" },
      {
        property: "og:description",
        content: "Sign in to JaanNee to add dishes, mark tried, and compare dishes head-to-head.",
      },
      { property: "og:url", content: "https://jaannee.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://jaannee.lovable.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const redirectTo = redirect && /^\/(?!\/)/.test(redirect) ? redirect : "/";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: redirectTo });
    });
  }, [navigate, redirectTo]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  const signInGoogle = async () => {
    setGoogleLoading(true);
    // Send OAuth back through this route, which completes the Supabase session
    // before navigating to the originally requested local page.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(error.message ?? "Google sign-in failed");
    }
  };

  const businessMode=redirectTo.startsWith("/business") ||
    redirectTo.startsWith("/restaurant");
  const copy=(en:string,th:string)=>lang==="th"?th:en;

  return <StitchSocialShell>
    <div className="stitch-auth-layout">
      <section className="stitch-auth-intro" aria-label={copy("Why join Jaannee","ทำไมต้องใช้ Jaannee")}>
        <p className="stitch-feed-eyebrow">{copy("Your food community","ชุมชนคนรักอาหาร")}</p>
        <h1>{businessMode?copy("Your restaurant, discovered.","ให้คนค้นพบร้านคุณ") :
          copy("A better way to find your next dish.","ค้นพบจานโปรดจานใหม่")}</h1>
        <p>{businessMode ?
          copy("Manage your free restaurant page, menus and verified presence. No food ordering or POS integration.",
            "จัดการหน้าร้านและเมนูของคุณ ไม่มีระบบรับออเดอร์หรือ POS"):
          copy("Follow diners you trust, save dishes you want to try and recommend only what you've genuinely eaten.",
            "ติดตามนักชิม บันทึกจานที่อยากลอง และแนะนำจานที่เคยกินจริง")}</p>
        <div className="stitch-auth-value-list">
          <p><Utensils size={19}/>{copy("Real dishes, not anonymous restaurant stars","ค้นพบจานอาหารจริง")}</p>
          <p><HeartHandshake size={19}/>{copy("Recommendations from people you follow","คำแนะนำจากคนที่ติดตาม")}</p>
          <p><ShieldCheck size={19}/>{copy("One account for diners and verified businesses","บัญชีเดียวใช้ได้ทั้งนักชิมและร้านอาหาร")}</p>
        </div>
      </section>
      <section className="stitch-auth-card" aria-label={copy("Sign in to Jaannee","เข้าสู่ระบบ Jaannee")}>
        <p className="stitch-feed-eyebrow">{t("auth_kicker")}</p>
        <h2>{t("sign_in")}</h2>
        <p className="stitch-auth-subtitle">
          {copy("One secure account. Choose where you'd like to continue.",
            "ใช้บัญชีเดียว เลือกวิธีใช้งาน")}
        </p>
        <nav className="stitch-auth-mode-select" aria-label={copy("Continue as","เข้าสู่ระบบในฐานะ")}>
          <Link to="/auth" search={{redirect:"/"}}
            aria-current={!businessMode?"page":undefined}
            className={!businessMode?"is-selected":undefined}>
            <Utensils size={20}/><span>{copy("Diner","นักชิม")}</span>
          </Link>
          <Link to="/auth" search={{redirect:"/business"}}
            aria-current={businessMode?"page":undefined}
            className={businessMode?"is-selected":undefined}>
            <Store size={20}/><span>{copy("Restaurant","ร้านอาหาร")}</span>
          </Link>
        </nav>
        {sent?<div className="stitch-auth-notice" role="status">
          <Mail size={23}/>
          <strong>{t("auth_check_inbox")}</strong>
          <p>{t("auth_check_inbox_body")}</p>
          <button type="button" onClick={()=>setSent(false)}>
            {copy("Use a different email","ใช้อีเมลอื่น")}
          </button>
        </div>:<form onSubmit={send} className="stitch-auth-form">
          <label htmlFor="stitch-email">{copy("Email address","อีเมล")}</label>
          <Input id="stitch-email" type="email" required autoComplete="email"
            placeholder="you@example.com" value={email}
            onChange={e=>setEmail(e.target.value)} />
          <Button type="submit" disabled={loading} className="w-full min-h-12">
            {loading?t("auth_sending"):t("auth_email_link")}
          </Button>
        </form>}
        {!sent?<div className="stitch-auth-google">
          <div className="stitch-auth-separator"><span/>{t("auth_or")}<span/></div>
          <Button type="button" variant="outline" className="w-full min-h-12"
            disabled={googleLoading} onClick={signInGoogle}>
            {googleLoading?t("auth_opening_google"):t("auth_google")}
          </Button>
        </div>:null}
        <p className="stitch-auth-footnote">
          {copy("Diner and restaurant views share the same login. Restaurant management still requires ownership verification.",
            "นักชิมและร้านใช้บัญชีเดียวกัน แต่การจัดการร้านต้องยืนยันสิทธิ์ก่อน")}
        </p>
      </section>
    </div>
  </StitchSocialShell>;
}
