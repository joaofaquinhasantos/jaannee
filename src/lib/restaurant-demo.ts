const demoPhoto = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=82`;

export const demoRestaurantProfile = {
  place_id: "demo-restaurant",
  is_verified: true,
  official_description:
    "A modern Bangkok neighbourhood restaurant built around seasonal Thai ingredients, relaxed counter dining, and late-night plates.",
  menu_url: "https://example.com/menu",
  reservation_url: "https://example.com/reservations",
  logo_url: demoPhoto("photo-1552566626-52f8b828add9"),
  cover_url: demoPhoto("photo-1515003197210-e0cd71810b5f"),
  line_url: "https://line.me/",
  instagram_url: "https://instagram.com/",
  phone: "02 000 0000",
  place: {
    id: "demo-restaurant",
    name: "JaanNee Test Kitchen",
    address: "Thonglor, Bangkok",
    google_maps_url: "https://maps.google.com/",
    area: { name_en: "Thonglor", name_th: "ทองหล่อ" },
  },
  updates: [
    {
      id: "demo-update-1",
      title: "Friday chef's counter seats",
      body: "Four seats just opened for this Friday's seasonal tasting menu.",
      photo_url: demoPhoto("photo-1414235077428-338989a2e8c0"),
      cta_label: "Book the counter",
      cta_url: "https://example.com/reservations",
      published_at: new Date().toISOString(),
    },
    {
      id: "demo-update-2",
      title: "New mango and coconut dessert",
      body: "Our summer dessert is now available every evening from 6pm.",
      photo_url: demoPhoto("photo-1551024506-0bccd828d307"),
      cta_label: "View the menu",
      cta_url: "https://example.com/menu",
      published_at: new Date().toISOString(),
    },
  ],
  gallery: [
    { id: "demo-gallery-1", photo_url: demoPhoto("photo-1516211697506-8360dbcfe9a4"), caption: "The dining room" },
    { id: "demo-gallery-2", photo_url: demoPhoto("photo-1547592180-85f173990554"), caption: "Seasonal vegetables" },
    { id: "demo-gallery-3", photo_url: demoPhoto("photo-1541544741938-0af808871cc0"), caption: "Counter dining" },
    { id: "demo-gallery-4", photo_url: demoPhoto("photo-1504674900247-0877df9cc836"), caption: "Dinner at JaanNee Test Kitchen" },
  ],
  dishes: [
    {
      id: "demo-dish-1",
      name_en: "Charred River Prawn",
      name_th: "กุ้งแม่น้ำย่าง",
      photo_url: demoPhoto("photo-1565299507177-b0ac66763828"),
      comparisons_count: 18,
      elo: 1128,
      status: "approved",
      place: { id: "demo-restaurant", name: "JaanNee Test Kitchen" },
    },
    {
      id: "demo-dish-2",
      name_en: "Mango Coconut",
      name_th: "มะม่วงมะพร้าว",
      photo_url: demoPhoto("photo-1571877227200-a0d98ea607e9"),
      comparisons_count: 7,
      elo: 1064,
      status: "approved",
      place: { id: "demo-restaurant", name: "JaanNee Test Kitchen" },
    },
    {
      id: "demo-dish-3",
      name_en: "Crab Fried Rice",
      name_th: "ข้าวผัดปู",
      photo_url: demoPhoto("photo-1603133872878-684f208fb84b"),
      comparisons_count: 4,
      elo: 1030,
      status: "approved",
      place: { id: "demo-restaurant", name: "JaanNee Test Kitchen" },
    },
  ],
};

