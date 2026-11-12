import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell, Bookmark, Compass, Home, Menu, Moon, Plus, Search, Store, Sun, UserRound,
} from "lucide-react";
import { useAuthUser } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import "./StitchSocial.css";

const mainNav = [
  { to: "/" as const, Icon: Home, en: "Home", th: "หน้าแรก" },
  { to: "/explore" as const, Icon: Compass, en: "Explore", th: "ค้นหา" },
  { to: "/submit" as const, Icon: Plus, en: "Add", th: "เพิ่มจาน" },
  { to: "/activity" as const, Icon: Bell, en: "Activity", th: "กิจกรรม" },
  { to: "/profile" as const, Icon: UserRound, en: "Profile", th: "โปรไฟล์" },
];

export function StitchSocialShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const auth = useAuthUser();
  const { lang, setLang } = useI18n();
  const [dark, setDark] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    try {
      setDark(window.localStorage.getItem("jaannee-social-dark") === "1");
    } catch { /* private browsing may block storage */ }
  }, []);
  const changeTheme = () => {
    setDark((current) => {
      try { window.localStorage.setItem("jaannee-social-dark", current ? "0" : "1"); }
      catch { /* theme still works for this session */ }
      return !current;
    });
  };
  const copy = (en: string, th: string) => lang === "th" ? th : en;
  const businessDestination = auth.status === "in" ? "/business" : "/auth";

  return <div className={"stitch-social min-h-[100dvh]" + (dark ? " stitch-social-dark" : "")}>
    <a className="stitch-skip-link" href="#social-main">{copy("Skip to feed", "ข้ามไปที่ฟีด")}</a>
    <aside className="stitch-social-sidebar" aria-label={copy("Main navigation", "เมนูหลัก")}>
      <Link to="/" className="stitch-brand">
        <span aria-hidden="true" className="stitch-brand-mark">จ</span>
        <span className="stitch-brand-name">Jaannee</span>
      </Link>
      <p className="stitch-brand-subtitle">{copy("Your city. One delicious dish at a time.", "ค้นพบจานเด็ดในเมืองของคุณ")}</p>
      <nav className="stitch-sidebar-links">
        {mainNav.map(({to,Icon,en,th})=>{
          const target=(to==="/profile"||to==="/activity") && auth.status !=="in" ? "/auth" : to;
          const active=to==="/" ? path==="/" : path.startsWith(to);
          return <Link key={to} to={target}
            search={target==="/auth"?{redirect:to==="/activity"?"/activity":"/profile"}:undefined}
            aria-current={active?"page":undefined}
            title={copy(en,th)}
            className={"stitch-sidebar-link" + (active?" is-active":"")}>
            <Icon size={21} strokeWidth={2} aria-hidden="true"/>
            <span>{copy(en,th)}</span>
          </Link>;
        })}
      </nav>
      <Link to="/submit" className="stitch-sidebar-cta">
        <Plus size={18} aria-hidden="true"/>
        <span>{copy("Add a dish", "เพิ่มเมนู")}</span>
      </Link>
      <div className="stitch-sidebar-bottom">
        <Link to={auth.status==="in"?"/saved":"/auth"}
          search={auth.status==="in"?undefined:{redirect:"/saved"}}
          className="stitch-sidebar-business">
          <Bookmark size={19} aria-hidden="true"/>
          <span>{copy("Want to Try", "อยากลอง")}</span>
        </Link>
        <Link to={businessDestination} search={businessDestination==="/auth"?{redirect:"/business"}:undefined}
          className="stitch-sidebar-business">
          <Store size={19} aria-hidden="true"/>
          <span>{copy("For restaurants", "สำหรับร้านอาหาร")}</span>
        </Link>
        <p>{copy("Dish-first discovery. Not ordering or payment.", "ค้นหาอาหาร ไม่รับออเดอร์หรือชำระเงิน")}</p>
      </div>
    </aside>
    <div className="stitch-social-workspace">
      <header className="stitch-social-topbar">
        <div className="stitch-social-topbar-left">
          <button type="button" className="stitch-mobile-more"
            aria-label={copy("Open shortcuts", "เปิดทางลัด")}
            aria-expanded={more} onClick={()=>setMore(!more)}>
            <Menu size={22}/>
          </button>
          <Link to="/" className="stitch-top-brand">
            <span className="stitch-top-brand-symbol">จ</span> Jaannee
          </Link>
          <span className="stitch-topbar-divider"/>
          <span className="stitch-topbar-caption">{copy("Bangkok food discoveries", "จานเด็ดกรุงเทพฯ")}</span>
        </div>
        <div className="stitch-top-actions">
          <Link to="/explore" aria-label={copy("Search dishes", "ค้นหาอาหาร")} className="stitch-icon-action">
            <Search size={20} aria-hidden="true"/>
          </Link>
          <button type="button" onClick={changeTheme} className="stitch-icon-action"
            aria-label={dark?copy("Switch to light mode", "เปลี่ยนเป็นโหมดสว่าง"):copy("Switch to dark mode", "เปลี่ยนเป็นโหมดมืด")}>
            {dark?<Sun size={20}/>:<Moon size={20}/>}
          </button>
          <button type="button" className="stitch-lang-toggle" onClick={()=>setLang(lang==="en"?"th":"en")}
            aria-label={copy("Switch language to Thai", "เปลี่ยนภาษาเป็นอังกฤษ")}>
            {lang==="en"?"TH":"EN"}
          </button>
          <Link to={auth.status==="in"?"/profile":"/auth"} className="stitch-account-pill">
            <UserRound size={17} aria-hidden="true"/>
            <span>{auth.status==="in"?copy("My profile", "โปรไฟล์"):copy("Sign in", "เข้าสู่ระบบ")}</span>
          </Link>
        </div>
      </header>
      {more?<div className="stitch-mobile-shortcuts">
        <Link to={auth.status==="in"?"/saved":"/auth"}
          search={auth.status==="in"?undefined:{redirect:"/saved"}} onClick={()=>setMore(false)}>
          <Bookmark size={18}/>{copy("Want to Try", "อยากลอง")}
        </Link>
        <Link to={businessDestination} search={businessDestination==="/auth"?{redirect:"/business"}:undefined}
          onClick={()=>setMore(false)}>
          <Store size={18}/>{copy("Restaurant workspace", "เครื่องมือร้านอาหาร")}
        </Link>
        <Link to="/explore" onClick={()=>setMore(false)}>
          <Search size={18}/>{copy("Find dishes", "ค้นหาอาหาร")}
        </Link>
      </div>:null}
      <main id="social-main" className="stitch-social-main">{children}</main>
      <footer className="stitch-social-footer">
        <span>Jaannee © {new Date().getFullYear()}</span>
        <span>{copy("Discover the dish, not just the restaurant.", "ค้นพบจานอร่อย ไม่ใช่แค่ร้าน")}</span>
      </footer>
    </div>
    <nav className="stitch-bottom-navigation" aria-label={copy("Mobile navigation", "เมนูมือถือ")}>
      {mainNav.map(({to,Icon,en,th})=>{
        const active=to==="/" ? path==="/" : path.startsWith(to);
        const target=(to==="/profile"||to==="/activity") && auth.status!=="in"?"/auth":to;
        return <Link key={to} to={target}
          search={target==="/auth"?{redirect:"/profile"}:undefined}
          aria-current={active?"page":undefined}
          className={"stitch-bottom-link"+(active?" is-active":"")+(to==="/submit"?" stitch-bottom-add":"")}>
          <Icon size={to==="/submit"?24:21} strokeWidth={2} aria-hidden="true"/>
          <span>{copy(en,th)}</span>
        </Link>;
      })}
    </nav>
  </div>;
}
