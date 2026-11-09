/** Entirely fictional restaurant/business-demo fixtures. Never import real services. */

export const MENU_LANGUAGES = ["en", "th", "zh", "fr", "ja"] as const;
export type MenuLanguage = (typeof MENU_LANGUAGES)[number];
export type RestaurantPlan = "free" | "pro" | "growth";
export type DemoMenuItem = {
  id: string;
  category: string;
  priceThb: number;
  available: boolean;
  names: Record<MenuLanguage, string>;
  descriptions: Record<MenuLanguage, string>;
};

export type DemoRestaurantDraft = {
  name: string;
  area: string;
  cuisine: string;
  description: string;
};

export type RestaurantDemoFeature =
  | "restaurant_page"
  | "menu_editor"
  | "basic_qr"
  | "ai_translation"
  | "qr_branding"
  | "analytics"
  | "promotions"
  | "vouchers"
  | "loyalty";

export const BUSINESS_DEMO_PLANS: Record<RestaurantPlan, {
  name: string;
  priceThb: number;
  pitch: string;
  features: readonly RestaurantDemoFeature[];
}> = {
  free: {
    name: "Free",
    priceThb: 0,
    pitch: "Be discoverable and give guests a clean menu.",
    features: ["restaurant_page", "menu_editor", "basic_qr"],
  },
  pro: {
    name: "Pro",
    priceThb: 590,
    pitch: "Make the menu work in more languages.",
    features: ["restaurant_page", "menu_editor", "basic_qr", "ai_translation", "qr_branding", "analytics"],
  },
  growth: {
    name: "Growth",
    priceThb: 1490,
    pitch: "Bring guests back with permission-based campaigns.",
    features: [
      "restaurant_page", "menu_editor", "basic_qr",
      "ai_translation", "qr_branding", "analytics",
      "promotions", "vouchers", "loyalty",
    ],
  },
};

export const BUSINESS_FEATURE_LABELS: Record<RestaurantDemoFeature, string> = {
  restaurant_page: "Free restaurant page",
  menu_editor: "Manage your own menu",
  basic_qr: "Basic QR menu",
  ai_translation: "AI-assisted multilingual menu",
  qr_branding: "Custom QR appearance",
  analytics: "Menu viewing analytics",
  promotions: "Restaurant-page promotions",
  vouchers: "Permission-based vouchers",
  loyalty: "Restaurant loyalty program",
};

export function planHasFeature(plan: RestaurantPlan, feature: RestaurantDemoFeature) {
  return BUSINESS_DEMO_PLANS[plan].features.includes(feature);
}

export const businessDemoRestaurant: DemoRestaurantDraft = {
  name: "Copper Basil Kitchen",
  area: "Ari, Bangkok",
  cuisine: "Modern Thai",
  description: "A fictional neighborhood kitchen for aromatic wok dishes and comforting bowls.",
};

function languageValues(
  en: string, th: string, zh: string, fr: string, ja: string,
): Record<MenuLanguage, string> {
  return { en, th, zh, fr, ja };
}

export const businessDemoMenu: DemoMenuItem[] = [
  {
    id: "basil-pork",
    category: "Rice plates",
    priceThb: 120,
    available: true,
    names: languageValues(
      "Holy Basil Pork & Fried Egg", "ข้าวกะเพราหมูไข่ดาว",
      "罗勒炒猪肉配煎蛋", "Porc au basilic thaï et œuf au plat", "豚肉のガパオライスと目玉焼き",
    ),
    descriptions: languageValues(
      "Wok-fried pork, holy basil, chili and jasmine rice.",
      "หมูผัดกะเพรา พริก และข้าวหอมมะลิ",
      "猪肉、圣罗勒、辣椒与茉莉香米。",
      "Porc sauté, basilic sacré, piment et riz jasmin.",
      "豚肉、ホーリーバジル、唐辛子、ジャスミンライス。",
    ),
  },
  {
    id: "pad-thai",
    category: "Noodles",
    priceThb: 150,
    available: true,
    names: languageValues(
      "Tamarind Prawn Pad Thai", "ผัดไทยกุ้งสด",
      "罗望子鲜虾泰式炒河粉", "Pad thaï aux crevettes et tamarin", "海老のパッタイ",
    ),
    descriptions: languageValues(
      "Rice noodles with prawns, tamarind, peanuts and lime.",
      "เส้นจันท์ผัดกุ้ง ซอสมะขาม ถั่วลิสง และมะนาว",
      "米粉、鲜虾、罗望子、花生和青柠。",
      "Nouilles de riz, crevettes, tamarin, cacahuètes et citron vert.",
      "米麺、海老、タマリンド、ピーナッツ、ライム。",
    ),
  },
  {
    id: "khao-soi",
    category: "Noodles",
    priceThb: 175,
    available: true,
    names: languageValues(
      "Chicken Coconut Khao Soi", "ข้าวซอยไก่",
      "鸡肉椰奶咖喱面", "Khao soi au poulet et lait de coco", "鶏肉のカオソーイ",
    ),
    descriptions: languageValues(
      "Northern Thai coconut curry noodles with crispy topping.",
      "บะหมี่แกงกะทิแบบเหนือ เสิร์ฟพร้อมเส้นกรอบ",
      "泰北椰奶咖喱面，配香脆面条。",
      "Nouilles au curry de coco du nord de la Thaïlande.",
      "北タイ風ココナッツカレー麺、揚げ麺添え。",
    ),
  },
  {
    id: "tom-yum",
    category: "Soups",
    priceThb: 210,
    available: true,
    names: languageValues(
      "Hot & Sour Prawn Soup", "ต้มยำกุ้ง",
      "冬阴功鲜虾汤", "Soupe épicée et acidulée aux crevettes", "トムヤムクン",
    ),
    descriptions: languageValues(
      "Prawns, lemongrass, lime leaf and a chili-lime broth.",
      "กุ้ง ตะไคร้ ใบมะกรูด และน้ำซุปรสเผ็ดเปรี้ยว",
      "鲜虾、香茅、青柠叶与酸辣汤。",
      "Crevettes, citronnelle, feuilles de combava et bouillon pimenté.",
      "海老、レモングラス、こぶみかんの葉、酸辣スープ。",
    ),
  },
  {
    id: "mango-rice",
    category: "Desserts",
    priceThb: 140,
    available: true,
    names: languageValues(
      "Mango Sticky Rice", "ข้าวเหนียวมะม่วง",
      "芒果糯米饭", "Riz gluant à la mangue", "マンゴーともち米",
    ),
    descriptions: languageValues(
      "Sweet coconut sticky rice with ripe mango.",
      "ข้าวเหนียวมูนกะทิและมะม่วงสุก",
      "椰奶糯米饭配熟芒果。",
      "Riz gluant au lait de coco et mangue mûre.",
      "ココナッツ風味のもち米と完熟マンゴー。",
    ),
  },
];

export const BUSINESS_LANGUAGE_NAMES: Record<MenuLanguage, string> = {
  en: "English",
  th: "ไทย",
  zh: "中文",
  fr: "Français",
  ja: "日本語",
};

/** Always produce an isolated and publicly viewable *sample*, never a private draft. */
export function sampleQrDestination(origin: string): string {
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("QR menu requires an HTTP(S) destination");
  }
  return new URL("/demo-business?screen=preview&sample=1", url).toString();
}

export function previewQrImageUrl(destination: string, customBrand = false): string {
  const url = new URL("https://quickchart.io/qr");
  url.searchParams.set("text", destination);
  url.searchParams.set("format", "svg");
  url.searchParams.set("size", "360");
  url.searchParams.set("margin", "4");
  url.searchParams.set("ecLevel", "M");
  url.searchParams.set("dark", customBrand ? "2a2929" : "000000");
  url.searchParams.set("light", "ffffff");
  return url.toString();
}

export function validateBusinessDraft(draft: DemoRestaurantDraft): string | null {
  if (draft.name.trim().length < 3) return "Restaurant name must be at least three characters.";
  if (draft.name.length > 80) return "Restaurant name must be under 80 characters.";
  if (draft.area.trim().length < 2) return "Add a neighborhood or area.";
  if (draft.cuisine.trim().length < 2) return "Add a cuisine or restaurant type.";
  return null;
}

export function createEmptyDemoMenuItem(sequence: number): DemoMenuItem {
  return {
    id: "draft-" + sequence,
    category: "New dishes",
    priceThb: 0,
    available: true,
    names: { en: "", th: "", zh: "", fr: "", ja: "" },
    descriptions: { en: "", th: "", zh: "", fr: "", ja: "" },
  };
}
