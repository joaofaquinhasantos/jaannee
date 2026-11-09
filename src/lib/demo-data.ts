/** 
 * JaanNee's isolated editorial demo fixtures.
 *
 * Every diner and restaurant is fictional. All photography is illustrative,
 * not documentation of a named dish or venue. Scores and votes are sample data.
 * No Supabase access, server mutations, or payment links belong in this module.
 */
export const DEMO_DISCLAIMER =
  "DEMO ONLY · Fictional venues and diners · Illustrative food photography · Sample rankings";

export const demoCategories = [
  "Pad Kra Pao",
  "Pad Thai",
  "Khao Soi",
  "Tom Yum",
  "Som Tam",
  "Boat Noodles",
  "Sushi",
  "Dim Sum",
  "Specialty Coffee",
  "Mango Sticky Rice",
] as const;
export type DemoCategory = (typeof demoCategories)[number];

export type DemoRestaurant = {
  id: string;
  name: string;
  area: string;
  subtitle: string;
  intro: string;
};

export const demoRestaurants: DemoRestaurant[] = [
  { id: "golden-wok", name: "Golden Wok Lab", area: "Ari", subtitle: "Thai comfort food", intro: "An imaginary neighborhood kitchen focused on aromatic wok cooking and everyday Thai favorites." },
  { id: "little-tamarind", name: "Little Tamarind", area: "Asok", subtitle: "Everyday Thai", intro: "A fictional casual counter serving bright, balanced dishes made for busy Bangkok lunches." },
  { id: "north-bowl", name: "North Bowl Atelier", area: "Thong Lo", subtitle: "Northern-style bowls", intro: "A fictional kitchen exploring curry noodles and northern Thai flavors." },
  { id: "river-steam", name: "River Steam House", area: "Chinatown", subtitle: "Steamed and shared", intro: "A fictional dim sum and noodle house with baskets for sharing." },
  { id: "pepper-basil", name: "Pepper & Basil", area: "Sathorn", subtitle: "Spice and fire", intro: "A fictional restaurant built around spicy favorites, crisp herbs and freshly cooked plates." },
  { id: "after-rain", name: "After Rain Coffee", area: "Ekkamai", subtitle: "Coffee and sweets", intro: "A fictional quiet cafe for slow mornings, espresso and Thai desserts." },
  { id: "midnight-noodles", name: "Midnight Noodle Club", area: "Silom", subtitle: "Noodles after dark", intro: "A fictional noodle shop with rich broths and a short late-night menu." },
  { id: "palm-counter", name: "Palm Grove Counter", area: "On Nut", subtitle: "Seasonal plates", intro: "A fictional open kitchen where fresh fruit, herbs and seafood shape the menu." },
  { id: "mango-room", name: "Mango Room Studio", area: "Siam", subtitle: "Desserts and drinks", intro: "A fictional dessert bar celebrating mango, coconut and freshly brewed drinks." },
  { id: "tokyo-soi", name: "Tokyo Soi Table", area: "Chatuchak", subtitle: "Japanese-inspired bites", intro: "A fictional neighborhood restaurant serving sushi, steamed bites and small plates." },
];

const PHOTO_IDS: Record<DemoCategory, readonly string[]> = {
  "Pad Kra Pao": ["photo-1504674900247-0877df9cc836", "photo-1547592180-85f173990554"],
  "Pad Thai": ["photo-1559847844-5315695dadae", "photo-1498837167922-ddd27525d352"],
  "Khao Soi": ["photo-1569718212165-3a8278d5f624", "photo-1562565652-a0d8f0c59eb4"],
  "Tom Yum": ["photo-1547592180-85f173990554", "photo-1559847844-5315695dadae"],
  "Som Tam": ["photo-1512621776951-a57141f2eefd", "photo-1540189549336-e6e99c3679fe"],
  "Boat Noodles": ["photo-1569718212165-3a8278d5f624", "photo-1504674900247-0877df9cc836"],
  "Sushi": ["photo-1579871494447-9811cf80d66c", "photo-1553621042-f6e147245754"],
  "Dim Sum": ["photo-1563245372-f21724e3856d", "photo-1559847844-5315695dadae"],
  "Specialty Coffee": ["photo-1509042239860-f550ce710b93", "photo-1442512595331-e89e73853f31"],
  "Mango Sticky Rice": ["photo-1551024506-0bccd828d307", "photo-1571877227200-a0d98ea607e9"],
};

export type DemoDish = {
  id: string;
  name: string;
  nameTh: string;
  category: DemoCategory;
  restaurantId: string;
  price: number;
  description: string;
  image: string;
  score: number;
  comparisons: number;
  sampleTries: number;
};

type DishFixture = readonly [id: string, name: string, nameTh: string, category: DemoCategory, restaurantId: string, price: number, description: string];

const DISH_FIXTURES: readonly DishFixture[] = [
  ["fire-basil-pork", "Fire Basil Pork", "กะเพราหมูสับไฟแรง", "Pad Kra Pao", "golden-wok", 105, "Wok-seared minced pork, holy basil and a crisp fried egg."],
  ["beef-basil-crunch", "Beef Basil Crunch", "กะเพราเนื้อไข่ดาว", "Pad Kra Pao", "pepper-basil", 145, "Tender beef, chilies, holy basil and a golden-edged egg."],
  ["chicken-basil-rice", "Chicken Basil Rice", "ข้าวกะเพราไก่", "Pad Kra Pao", "little-tamarind", 95, "Aromatic chicken stir-fried at high heat and served over jasmine rice."],
  ["mushroom-basil-wok", "Mushroom Basil Wok", "กะเพราเห็ด", "Pad Kra Pao", "palm-counter", 115, "Mixed mushrooms with garlicky chili and a punch of holy basil."],
  ["river-prawn-pad-thai", "River Prawn Pad Thai", "ผัดไทยกุ้งแม่น้ำ", "Pad Thai", "river-steam", 190, "Tamarind noodles, herbs, peanuts and a river-prawn finish."],
  ["classic-shrimp-pad-thai", "Classic Shrimp Pad Thai", "ผัดไทยกุ้งสด", "Pad Thai", "little-tamarind", 125, "A citrus-bright take on Thailand's beloved stir-fried noodles."],
  ["crispy-tofu-pad-thai", "Crispy Tofu Pad Thai", "ผัดไทยเต้าหู้กรอบ", "Pad Thai", "palm-counter", 110, "Soft rice noodles and crunchy tofu with balanced sweet-sour sauce."],
  ["crab-pad-thai", "Crab Pad Thai", "ผัดไทยปู", "Pad Thai", "golden-wok", 175, "Lightly charred noodles with fresh crab, lime and bean sprouts."],
  ["khao-soi-chicken", "Coconut Chicken Khao Soi", "ข้าวซอยไก่", "Khao Soi", "north-bowl", 160, "Golden coconut curry with braised chicken and crunchy noodle topping."],
  ["khao-soi-beef", "Slow-Cooked Beef Khao Soi", "ข้าวซอยเนื้อตุ๋น", "Khao Soi", "midnight-noodles", 195, "Warm curry broth with tender beef and pickled mustard greens."],
  ["khao-soi-mushroom", "Mushroom Khao Soi", "ข้าวซอยเห็ด", "Khao Soi", "north-bowl", 145, "A richly spiced mushroom curry bowl with fresh herbs."],
  ["khao-soi-shrimp", "Prawn Khao Soi", "ข้าวซอยกุ้ง", "Khao Soi", "palm-counter", 190, "Silky coconut curry, prawns, shallots and crisp noodles."],
  ["clear-tom-yum", "Clear Tom Yum Prawns", "ต้มยำกุ้งน้ำใส", "Tom Yum", "little-tamarind", 175, "Hot-and-sour clear soup with lemongrass, lime and juicy prawns."],
  ["creamy-tom-yum", "Creamy Tom Yum Seafood", "ต้มยำทะเลน้ำข้น", "Tom Yum", "pepper-basil", 230, "A fragrant creamy broth packed with seafood and galangal."],
  ["mushroom-tom-yum", "Forest Mushroom Tom Yum", "ต้มยำเห็ดรวม", "Tom Yum", "palm-counter", 145, "Fragrant hot-and-sour soup with mushrooms and aromatic herbs."],
  ["tom-yum-noodles", "Tom Yum Noodle Bowl", "ก๋วยเตี๋ยวต้มยำ", "Tom Yum", "midnight-noodles", 130, "Tangy noodle broth with crushed peanuts and fresh chilies."],
  ["green-papaya-som-tam", "Classic Green Papaya Salad", "ส้มตำไทย", "Som Tam", "pepper-basil", 95, "Crisp green papaya, lime and a lively chili kick."],
  ["salted-crab-som-tam", "Salted Crab Som Tam", "ส้มตำปูปลาร้า", "Som Tam", "little-tamarind", 110, "Bold, savory papaya salad with salted crab dressing."],
  ["corn-som-tam", "Sweet Corn Som Tam", "ตำข้าวโพด", "Som Tam", "palm-counter", 105, "Sweet corn, tomato and citrus in a refreshing spicy salad."],
  ["mango-som-tam", "Green Mango Som Tam", "ตำมะม่วง", "Som Tam", "golden-wok", 115, "Tart shredded mango, crunchy peanuts and red chilies."],
  ["dark-boat-noodles", "Rich Beef Boat Noodles", "ก๋วยเตี๋ยวเรือเนื้อ", "Boat Noodles", "midnight-noodles", 110, "Deeply aromatic beef broth with delicate rice noodles."],
  ["pork-boat-noodles", "Classic Pork Boat Noodles", "ก๋วยเตี๋ยวเรือหมู", "Boat Noodles", "river-steam", 95, "A small hearty bowl with pork, herbs and spiced broth."],
  ["herbal-boat-noodles", "Herbal Boat Noodles", "ก๋วยเตี๋ยวเรือสมุนไพร", "Boat Noodles", "north-bowl", 115, "Herbal broth, slow-cooked meat and aromatic greens."],
  ["crispy-pork-noodles", "Crispy Pork Noodles", "ก๋วยเตี๋ยวหมูกรอบ", "Boat Noodles", "golden-wok", 125, "Savory noodles layered with crispy pork and fragrant stock."],
  ["salmon-nigiri", "Salmon Nigiri Selection", "ซูชิแซลมอน", "Sushi", "tokyo-soi", 260, "A short selection of hand-pressed salmon nigiri."],
  ["tuna-maki", "Tuna Maki Rolls", "มากิทูน่า", "Sushi", "tokyo-soi", 230, "Clean, simple tuna rolls with seasoned rice."],
  ["avocado-sushi", "Avocado Garden Rolls", "ซูชิอะโวคาโด", "Sushi", "after-rain", 185, "Vegetable rolls layered with avocado and sesame."],
  ["seared-salmon", "Seared Salmon Bites", "แซลมอนเบิร์น", "Sushi", "river-steam", 275, "Briefly flame-seared salmon with citrus seasoning."],
  ["shrimp-dumplings", "Crystal Shrimp Dumplings", "ฮะเก๋ากุ้ง", "Dim Sum", "river-steam", 155, "Delicate translucent wrappers enclosing seasoned shrimp."],
  ["pork-siu-mai", "Pork Siu Mai Basket", "ขนมจีบหมู", "Dim Sum", "river-steam", 140, "Steamed pork dumplings finished with a touch of sesame."],
  ["char-siu-buns", "Barbecue Pork Buns", "ซาลาเปาหมูแดง", "Dim Sum", "tokyo-soi", 135, "Soft steamed buns filled with sweet-savory roast pork."],
  ["mushroom-dumplings", "Wild Mushroom Dumplings", "เกี๊ยวเห็ดนึ่ง", "Dim Sum", "little-tamarind", 135, "Hand-folded dumplings with savory mushroom filling."],
  ["honey-iced-latte", "Honey Iced Latte", "ลาเต้น้ำผึ้งเย็น", "Specialty Coffee", "after-rain", 140, "Espresso over milk with a subtle honey finish."],
  ["orange-espresso", "Orange Espresso", "เอสเปรสโซส้ม", "Specialty Coffee", "mango-room", 145, "A sharp, bright mix of espresso and fresh orange."],
  ["filter-coffee", "Seasonal Filter Coffee", "กาแฟดริปพิเศษ", "Specialty Coffee", "after-rain", 165, "Aromatic hand-brewed coffee with light floral notes."],
  ["coconut-cold-brew", "Coconut Cold Brew", "โคลด์บรูว์มะพร้าว", "Specialty Coffee", "mango-room", 160, "Cold-brew coffee with delicate fresh coconut sweetness."],
  ["classic-mango-rice", "Golden Mango Sticky Rice", "ข้าวเหนียวมะม่วง", "Mango Sticky Rice", "mango-room", 145, "Ripe mango with coconut sticky rice and toasted mung beans."],
  ["black-rice-mango", "Black Sticky Rice & Mango", "ข้าวเหนียวดำมะม่วง", "Mango Sticky Rice", "after-rain", 165, "Nutty black sticky rice paired with ripe mango."],
  ["coconut-mango-cup", "Coconut Mango Cup", "ถ้วยมะม่วงกะทิ", "Mango Sticky Rice", "palm-counter", 135, "A compact mango dessert with lightly salted coconut cream."],
  ["mango-mochi-rice", "Mango Mochi Rice", "ข้าวเหนียวมะม่วงโมจิ", "Mango Sticky Rice", "mango-room", 175, "A playful mango and coconut rice reinterpretation."],
];

export const demoDishes: DemoDish[] = DISH_FIXTURES.map(
  ([id, name, nameTh, category, restaurantId, price, description], index) => ({
    id,
    name,
    nameTh,
    category,
    restaurantId,
    price,
    description,
    image: `https://images.unsplash.com/${PHOTO_IDS[category][index % PHOTO_IDS[category].length]}?auto=format&fit=crop&w=960&q=78`,
    score: 87 + ((index * 11) % 12),
    comparisons: 12 + ((index * 7) % 51),
    sampleTries: 28 + ((index * 23) % 230),
  }),
);

export type DemoRecommendation = { dishId: string; note: string };
export type DemoPerson = {
  username: string;
  name: string;
  initials: string;
  bio: string;
  color: string;
  picks: DemoRecommendation[];
};

export const demoPeople: DemoPerson[] = [
  { username: "nina_eats", name: "Nina", initials: "N", color: "#873e2a", bio: "Noodles, little kitchens and the perfect late lunch.", picks: [
    { dishId: "khao-soi-chicken", note: "The curry-to-crunch ratio is what I keep coming back for." },
    { dishId: "river-prawn-pad-thai", note: "This is my kind of weekend noodle plate." },
    { dishId: "honey-iced-latte", note: "Simple, balanced and not too sweet." },
  ] },
  { username: "ton_tastes", name: "Ton", initials: "T", color: "#435346", bio: "Searching for Bangkok's best wok-fired dishes.", picks: [
    { dishId: "fire-basil-pork", note: "Exactly the bold basil and crispy egg I want." },
    { dishId: "beef-basil-crunch", note: "A great spicy lunch pick." },
    { dishId: "dark-boat-noodles", note: "Rich broth, small bowl, big flavor." },
  ] },
  { username: "maybytheway", name: "May", initials: "M", color: "#745069", bio: "Dessert first. Always looking for one more cafe.", picks: [
    { dishId: "classic-mango-rice", note: "The coconut cream makes it." },
    { dishId: "orange-espresso", note: "Bright and very refreshing." },
    { dishId: "khao-soi-chicken", note: "Comfort food worth going out for." },
  ] },
  { username: "arun_afterdark", name: "Arun", initials: "A", color: "#3b5366", bio: "Night-market energy and comforting noodle bowls.", picks: [
    { dishId: "dark-boat-noodles", note: "An excellent late-evening bowl." },
    { dishId: "tom-yum-noodles", note: "Tangy and seriously comforting." },
    { dishId: "pork-boat-noodles", note: "I would order a second bowl." },
  ] },
  { username: "bee_on_a_plate", name: "Bee", initials: "B", color: "#957044", bio: "Sharing the dishes I would take a friend back for.", picks: [
    { dishId: "green-papaya-som-tam", note: "Fresh, crisp, and beautifully spicy." },
    { dishId: "clear-tom-yum", note: "Clean, punchy broth." },
    { dishId: "classic-mango-rice", note: "A lovely finish to a meal." },
  ] },
  { username: "pim_finds_food", name: "Pim", initials: "P", color: "#6a5a44", bio: "Small plates, dim sum and well-brewed coffee.", picks: [
    { dishId: "shrimp-dumplings", note: "The texture is the whole story." },
    { dishId: "salmon-nigiri", note: "An easy favorite to share." },
    { dishId: "filter-coffee", note: "Made for slow mornings." },
  ] },
];

export const demoAreas = Array.from(new Set(demoRestaurants.map((place) => place.area)));
export const restaurantFor = (dish: DemoDish): DemoRestaurant =>
  demoRestaurants.find((place) => place.id === dish.restaurantId)!;

export function rankDemoDishes(dishes: readonly DemoDish[]): DemoDish[] {
  return [...dishes].sort(
    (a, b) => b.score - a.score || b.comparisons - a.comparisons || a.id.localeCompare(b.id),
  );
}

export function filterDemoDishes(
  dishes: readonly DemoDish[],
  options: { category?: string; area?: string; query?: string },
): DemoDish[] {
  const query = options.query?.trim().toLocaleLowerCase() ?? "";
  return dishes.filter((dish) => {
    if (options.category && dish.category !== options.category) return false;
    if (options.area && restaurantFor(dish).area !== options.area) return false;
    if (!query) return true;
    const place = restaurantFor(dish);
    return [dish.name, dish.nameTh, dish.category, place.name, place.area].some(
      (text) => text.toLocaleLowerCase().includes(query),
    );
  });
}
