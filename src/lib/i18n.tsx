import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "th";

export const dict = {
  brand: { en: "JaanNee", th: "จานนี้" },
  tagline: { en: "Rank the dish, not the restaurant.", th: "จัดอันดับที่จาน ไม่ใช่ที่ร้าน" },
  nav_feed: { en: "Discover", th: "ค้นพบ" },
  nav_rankings: { en: "Rankings", th: "อันดับ" },
  nav_compare: { en: "Compare", th: "เปรียบเทียบ" },
  nav_submit: { en: "Add a dish", th: "เพิ่มจาน" },
  nav_profile: { en: "My dishes", th: "จานของฉัน" },
  nav_admin: { en: "Admin", th: "ผู้ดูแล" },
  sign_in: { en: "Sign in", th: "เข้าสู่ระบบ" },
  sign_out: { en: "Sign out", th: "ออกจากระบบ" },
  filter_all_categories: { en: "All categories", th: "ทุกหมวด" },
  filter_all_areas: { en: "All areas", th: "ทุกย่าน" },
  status_new: { en: "New Entry", th: "จานใหม่" },
  status_gathering: { en: "Gathering Comparisons", th: "กำลังรวบรวมข้อมูล" },
  status_top: { en: "Top Contender", th: "จานตัวเต็ง" },
  status_needs_update: { en: "Needs an Update", th: "ต้องอัปเดต" },
  added_ago: { en: "Added", th: "เพิ่มเมื่อ" },
  days_ago: { en: "days ago", th: "วันที่แล้ว" },
  compared_by: { en: "Compared by", th: "เปรียบเทียบโดย" },
  diners: { en: "diners", th: "คน" },
  tried_it: { en: "I've tried this", th: "เคยกินแล้ว" },
  tried_marked: { en: "Tried ✓", th: "กินแล้ว ✓" },
  compare_this: { en: "Compare this dish", th: "เปรียบเทียบจานนี้" },
  report: { en: "Report", th: "แจ้งปัญหา" },
  price: { en: "Price", th: "ราคา" },
  thb: { en: "THB", th: "บาท" },
  empty_feed: { en: "No dishes yet. Be the first to add one.", th: "ยังไม่มีจาน มาเพิ่มเป็นคนแรก" },
  loading: { en: "Loading…", th: "กำลังโหลด…" },
  share: { en: "Share", th: "แชร์" },
};

export type Key = keyof typeof dict;

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string; }
const Ctx = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: (k) => dict[k]?.en ?? k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("jn_lang") as Lang | null) : null;
    if (saved === "en" || saved === "th") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("jn_lang", l);
  };
  const t = (k: Key) => dict[k]?.[lang] ?? dict[k]?.en ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);