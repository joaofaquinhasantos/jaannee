import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "th";

export const dict = {
  cuisine_thai: { en: "Thai", th: "ไทย" },
  cuisine_italian: { en: "Italian", th: "อิตาเลียน" },
  cuisine_japanese: { en: "Japanese", th: "ญี่ปุ่น" },
  cuisine_western: { en: "Western", th: "ตะวันตก" },
  cuisine_dessert_cafe: { en: "Dessert & cafe", th: "ขนมและคาเฟ่" },
  cuisine_other: { en: "Other", th: "อื่นๆ" },
  search_categories: { en: "Search English, Thai, or slug", th: "ค้นหาชื่ออังกฤษ ไทย หรือ slug" },
  no_matching_categories: { en: "No matching categories.", th: "ไม่พบหมวดที่ตรงกัน" },
  add_new_place: { en: "Add a new place", th: "เพิ่มร้านใหม่" },
  selected_place: { en: "Selected", th: "เลือกแล้ว" },
  choose_area: { en: "Choose area", th: "เลือกย่าน" },
  filter_categories: { en: "Filter categories", th: "กรองหมวด" },
  filter_areas: { en: "Filter areas", th: "กรองย่าน" },
  cuisine: { en: "Cuisine", th: "ประเภทอาหาร" },
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
  more_categories: { en: "More categories", th: "หมวดเพิ่มเติม" },
  change_category: { en: "Change category", th: "เปลี่ยนหมวด" },
  more_areas: { en: "More areas", th: "ย่านเพิ่มเติม" },
  search_areas: { en: "Search area name or slug", th: "ค้นหาชื่อย่านหรือ slug" },
  no_matching_areas: { en: "No matching areas.", th: "ไม่พบย่านที่ตรงกัน" },
  status_new: { en: "New Entry", th: "จานใหม่" },
  status_gathering: { en: "Gathering Comparisons", th: "กำลังรวบรวมข้อมูล" },
  gathering_progress: { en: "Gathering comparisons", th: "กำลังรวบรวมข้อมูล" },
  comparisons_progress: { en: "comparisons", th: "การเปรียบเทียบ" },
  not_ranked_yet: {
    en: "Not ranked yet — compare dishes you've tried to build this ranking",
    th: "ยังไม่จัดอันดับ — เปรียบเทียบจานที่คุณเคยกินเพื่อสร้างอันดับนี้",
  },
  tried_by: { en: "Tried by", th: "เคยกินโดย" },
  youve_tried_too: { en: "You've tried", th: "คุณเคยกิน" },
  which_was_better: { en: "too — which was better?", th: "ด้วย — จานไหนดีกว่า" },
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
  hero_title: {
    en: "Find the best version of every dish.",
    th: "หาจานที่ดีที่สุดของแต่ละเมนู",
  },
  hero_copy: {
    en: "Discover local dishes, compare dish against dish, and add the gems missing from the map.",
    th: "ค้นหาจานเด็ด เปรียบเทียบจานต่อจาน และเพิ่มร้านที่ยังไม่มีในแผนที่",
  },
  cta_compare: { en: "Compare dishes", th: "เปรียบเทียบจาน" },
  cta_add: { en: "Add a dish", th: "เพิ่มจาน" },
  how_title: { en: "How JaanNee works", th: "JaanNee ทำงานอย่างไร" },
  how_discover: { en: "Discover dishes by category and area.", th: "ค้นหาจานตามหมวดหมู่และย่าน" },
  how_compare: {
    en: "Choose the better dish in quick head-to-head votes.",
    th: "โหวตเลือกจานที่ดีกว่าแบบตัวต่อตัว",
  },
  how_submit: {
    en: "Submit missing dishes so the rankings get sharper.",
    th: "เพิ่มจานที่ยังไม่มีเพื่อให้อันดับแม่นขึ้น",
  },
  empty_feed_title: {
    en: "The board is waiting for its first dishes.",
    th: "กระดานนี้กำลังรอจานแรก",
  },
  empty_feed_body: {
    en: "Add a dish or clear filters to start building the ranking.",
    th: "เพิ่มจานหรือล้างตัวกรองเพื่อเริ่มสร้างอันดับ",
  },
  rankings_intro: {
    en: "Rank positions appear only after a dish earns 5 comparisons inside its dish type.",
    th: "อันดับสดใช้ผลเปรียบเทียบทั้งหมด จานที่คะแนนยังน้อยจะติดป้ายชั่วคราวจนกว่าจะครบ 5 โหวต",
  },
  provisional: { en: "Provisional", th: "ชั่วคราว" },
  trusted_rank: { en: "Trusted rank", th: "อันดับน่าเชื่อถือ" },
  empty_rankings_title: { en: "No ranked dishes here yet.", th: "ยังไม่มีอันดับในหมวดนี้" },
  empty_rankings_body: {
    en: "Add dishes or compare existing ones to bring this board to life.",
    th: "เพิ่มจานหรือเปรียบเทียบจานที่มีเพื่อให้กระดานนี้เริ่มมีชีวิต",
  },
  compare_intro: {
    en: "Choose two dishes in the same category. Pick the one you would order again.",
    th: "เลือกสองจานในหมวดเดียวกัน แล้วโหวตจานที่อยากกลับไปกินอีก",
  },
  choose_category: { en: "Choose category", th: "เลือกหมวดหมู่" },
  pick_dish: { en: "Pick a dish", th: "เลือกจาน" },
  which_better: { en: "Which was better?", th: "จานไหนดีกว่า" },
  compare_empty: {
    en: "This category needs at least two approved dishes before comparisons can start.",
    th: "หมวดนี้ต้องมีจานที่อนุมัติแล้วอย่างน้อยสองจานก่อนเริ่มเปรียบเทียบ",
  },
  sign_in_compare: { en: "Sign in to compare dishes.", th: "เข้าสู่ระบบเพื่อเปรียบเทียบจาน" },
  comparison_saved: { en: "Comparison saved", th: "บันทึกการเปรียบเทียบแล้ว" },
  submit_required: { en: "Fill required fields", th: "กรอกข้อมูลที่จำเป็นให้ครบ" },
  submit_done_title: { en: "Submitted. Thank you.", th: "ส่งแล้ว ขอบคุณ" },
  submit_done_body: {
    en: "Your dish is pending review. It will appear once approved.",
    th: "จานของคุณรอตรวจสอบ และจะแสดงเมื่ออนุมัติแล้ว",
  },
  back_to_feed: { en: "Back to feed", th: "กลับไปหน้าค้นพบ" },
  add_another: { en: "Add another", th: "เพิ่มอีกจาน" },
  duplicate_title: { en: "Is this one of these?", th: "ใช่รายการเหล่านี้ไหม" },
  duplicate_body: {
    en: "We found similar entries. Please check before adding.",
    th: "เราพบรายการใกล้เคียง กรุณาตรวจดูก่อนเพิ่ม",
  },
  back_to_edit: { en: "Back to edit", th: "กลับไปแก้ไข" },
  submit_anyway: { en: "None of these. Submit anyway", th: "ไม่ใช่รายการเหล่านี้ ส่งต่อ" },
  submit_for_review: { en: "Submit for review", th: "ส่งให้ตรวจสอบ" },
};

export type Key = keyof typeof dict;

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}
const Ctx = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: (k) => dict[k]?.en ?? k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? (localStorage.getItem("jn_lang") as Lang | null) : null;
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
