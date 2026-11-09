import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, Copy, Crown, Edit3, Globe,
  Heart, Languages, MapPin, Menu, Megaphone, Plus, QrCode,
  RotateCcw, ShieldCheck, Store, Trash2, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  BUSINESS_DEMO_PLANS, BUSINESS_FEATURE_LABELS, BUSINESS_LANGUAGE_NAMES,
  MENU_LANGUAGES, businessDemoMenu, businessDemoRestaurant,
  createEmptyDemoMenuItem, planHasFeature, previewQrImageUrl,
  sampleQrDestination, validateBusinessDraft,
  type DemoMenuItem, type DemoRestaurantDraft, type MenuLanguage,
  type RestaurantPlan,
} from "@/lib/business-demo";

type Screen = "home" | "create" | "editor" | "preview" | "qr" | "plans" | "growth";
type Search = { screen?: Screen; sample?: boolean };
const screens: Screen[] = ["home", "create", "editor", "preview", "qr", "plans", "growth"];
const card = "border border-white/15 bg-[#211f1e] p-5 sm:p-7";
const btn = "inline-flex min-h-11 items-center justify-center gap-2 border border-white/25 px-4 py-2 text-xs font-bold uppercase tracking-wide hover:border-[#f87f69]";
const primary = btn + " border-[#d6321f] bg-[#d6321f] text-white hover:bg-[#f05039]";
const field = "min-h-11 w-full border border-white/20 bg-[#151414] px-3 py-2 text-sm text-white outline-none focus:border-[#f36b57]";
const kicker = "text-[10px] font-bold uppercase tracking-[0.18em] text-[#f68a75]";

export const Route = createFileRoute("/demo-business")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    screen: typeof s.screen === "string" && screens.includes(s.screen as Screen) ? s.screen as Screen : "home",
    sample: s.sample === true || s.sample === "1" || s.sample === 1,
  }),
  head: () => ({
    meta: [
      { title: "JaanNee restaurant tools — fictional business demo" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "description", content: "A free restaurant page, editable menu, multilingual preview and QR sample without live services." },
    ],
  }),
  component: DemoBusinessPage,
});

function Head({ tag, title, note }: { tag: string; title: string; note: string }) {
  return <div className="max-w-3xl">
    <p className={kicker}>{tag}</p>
    <h1 className="mt-3 font-display text-[clamp(2.8rem,5.4vw,5.5rem)] leading-[0.95]">{title}</h1>
    <p className="mt-4 text-sm leading-7 text-white/65">{note}</p>
  </div>;
}

function Notice({ qr = false }: { qr?: boolean }) {
  return <p className="border-l-2 border-amber-300/70 bg-amber-300/5 p-3 text-xs leading-6 text-amber-100">
    {qr
      ? "This QR opens a fixed fictional menu. Changes to your draft are local and will not appear after scanning."
      : "DEMO ONLY: No real restaurant page, account, translation, payment, promotion or database entry is created. All changes are temporary."}
  </p>;
}

function Field({ label, value, onChange, max = 120 }: { label: string; value: string; onChange: (text: string) => void; max?: number }) {
  return <label className="block space-y-2">
    <span className="text-xs font-bold uppercase tracking-wide text-white/75">{label}</span>
    <input type="text" maxLength={max} className={field} value={value} onChange={(event) => onChange(event.target.value)}/>
  </label>;
}

function DemoBusinessPage() {
  const { screen = "home", sample = false } = Route.useSearch();
  const navigate = useNavigate({ from: "/demo-business" });
  const [restaurant, setRestaurant] = useState<DemoRestaurantDraft>({ ...businessDemoRestaurant });
  const [menu, setMenu] = useState<DemoMenuItem[]>(() => businessDemoMenu.map((item) => ({
    ...item, names: { ...item.names }, descriptions: { ...item.descriptions },
  })));
  const [plan, setPlan] = useState<RestaurantPlan>("free");
  const [language, setLanguage] = useState<MenuLanguage>("en");
  const [editing, setEditing] = useState<string | null>(null);
  const [sequence, setSequence] = useState(1);
  const [origin, setOrigin] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [voucherTitle, setVoucherTitle] = useState("Welcome back to our kitchen");
  const [voucherDiscount, setVoucherDiscount] = useState(10);
  useEffect(() => setOrigin(window.location.origin), []);

  const go = (next: Screen, isSample = false) => {
    setMobileNav(false);
    void navigate({ to: "/demo-business", search: { screen: next, sample: isSample } });
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  const reset = () => {
    setRestaurant({ ...businessDemoRestaurant });
    setMenu(businessDemoMenu.map((item) => ({ ...item, names: { ...item.names }, descriptions: { ...item.descriptions } })));
    setPlan("free"); setEditing(null); setLanguage("en"); setSequence(1);
    setVoucherTitle("Welcome back to our kitchen"); setVoucherDiscount(10);
    go("home");
    toast.message("Fictional restaurant workspace reset");
  };

  const updateItem = (id: string, patch: Partial<DemoMenuItem>) =>
    setMenu((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  const updateTranslation = (id: string, type: "names" | "descriptions", lang: MenuLanguage, value: string) =>
    setMenu((items) => items.map((item) => item.id === id
      ? { ...item, [type]: { ...item[type], [lang]: value } } : item));

  const addItem = () => {
    const item = createEmptyDemoMenuItem(sequence);
    setSequence((number) => number + 1);
    setMenu((items) => [...items, item]);
    setEditing(item.id);
    toast.message("New sample item added");
  };

  const availableMenu = (sample ? businessDemoMenu : menu).filter((item) => item.available && item.names.en.trim());
  const guestRestaurant = sample ? businessDemoRestaurant : restaurant;
  const languages: readonly MenuLanguage[] = sample || planHasFeature(plan, "ai_translation") ? MENU_LANGUAGES : ["en", "th"];
  const destination = origin ? sampleQrDestination(origin) : "";
  const qr = destination ? previewQrImageUrl(destination, planHasFeature(plan, "qr_branding")) : "";
  const nav: { key: Screen; name: string; Icon: typeof Store }[] = [
    { key: "home", name: "Overview", Icon: Store },
    { key: "create", name: "Business page", Icon: Edit3 },
    { key: "editor", name: "Menu editor", Icon: BookOpen },
    { key: "preview", name: "Guest menu", Icon: Globe },
    { key: "qr", name: "QR menu", Icon: QrCode },
    { key: "plans", name: "Plans", Icon: Crown },
    { key: "growth", name: "Growth", Icon: Megaphone },
  ];

  return <div className="noir-theme min-h-screen bg-[#121111] pb-24 text-[#faf8f4] md:pb-0">
    <p className="border-b border-amber-300/20 bg-[#38271e] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-amber-100">
      Fictional business demo · No live signup, AI, publishing, advertising or payments
    </p>
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#181716]/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[94rem] items-center justify-between gap-3 px-4 sm:px-7">
        <button type="button" onClick={() => go("home")} className="flex min-h-11 items-center gap-2">
          <span className="h-8 w-1.5 bg-[#d6321f]"/><span className="font-display text-3xl">JaanNee</span>
          <span className="hidden border-l border-white/25 pl-3 text-[10px] font-bold uppercase tracking-widest text-white/60 sm:block">For restaurants</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="border border-amber-200/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">{plan} preview</span>
          <Link to="/demo" search={{ view: "discover" }} className={btn + " hidden sm:inline-flex"}><ArrowLeft size={14}/> Diner demo</Link>
          <button type="button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle restaurant demo navigation"
            aria-expanded={mobileNav} className={btn + " md:hidden"}>{mobileNav ? <X size={16}/> : <Menu size={16}/>}</button>
        </div>
      </div>
      {mobileNav ? <nav className="grid grid-cols-2 gap-2 border-t border-white/10 p-3 md:hidden" aria-label="Business demo mobile menu">
        {nav.map(({key,name}) => <button type="button" key={key} onClick={() => go(key)} className={btn}>{name}</button>)}
        <Link to="/demo" search={{ view: "discover" }} className={btn}>Diner demo</Link>
      </nav> : null}
    </header>
    <div className="mx-auto grid max-w-[94rem] md:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-white/10 bg-[#181716] p-4 md:block">
        <nav className="sticky top-24 space-y-1" aria-label="Business demo navigation">
          {nav.map(({key,name,Icon}) => <button key={key} type="button" onClick={() => go(key)}
            aria-current={screen === key ? "page" : undefined}
            className={"flex min-h-12 w-full items-center gap-3 border-l-2 px-3 text-left text-xs font-bold uppercase tracking-wide hover:bg-white/5 " +
              (screen === key ? "border-[#e75741] text-[#f78a75]" : "border-transparent text-white/65")}>
            <Icon size={17}/>{name}
          </button>)}
          <button type="button" onClick={reset} className="mt-6 flex min-h-11 items-center gap-2 px-3 text-xs text-white/50 hover:text-white"><RotateCcw size={15}/> Reset demo</button>
          <p className="px-3 pt-4 text-xs leading-6 text-white/40">One account system, with distinct diner and verified business roles in the future application.</p>
        </nav>
      </aside>
      <main className="min-w-0 space-y-7 px-4 pb-14 pt-9 sm:px-8 lg:px-10">

        {screen === "home" ? <>
          <div className="relative overflow-hidden border border-white/10 bg-[#211c19] p-6 sm:p-10">
            <p className={kicker}>Restaurant business tools</p>
            <h1 className="mt-5 font-display text-[clamp(3.6rem,7vw,6.6rem)] leading-[0.9]">Your page.<br/><em className="text-[#f17662]">Your menu.</em><br/>Your regulars.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/65">Start free with a business page and menu. Upgrade for multilingual menus and tools that bring guests back.</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <button type="button" onClick={() => go("create")} className={primary}>Create a free page <ArrowRight size={16}/></button>
              <button type="button" onClick={() => go("plans")} className={btn}>See proposed plans</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["01 · FREE", "Create your page", "Restaurant identity, opening information and editable menu."],
              ["02 · PRO", "Serve every guest", "Sample translations, multilingual menu preview and branded QR."],
              ["03 · GROWTH", "Keep them coming back", "Opt-in vouchers, loyalty and sponsored placements."],
            ].map(([step,title,copy]) => <article key={step} className={card}>
              <p className={kicker}>{step}</p><h2 className="mt-3 font-display text-3xl">{title}</h2><p className="mt-3 text-sm leading-6 text-white/60">{copy}</p>
            </article>)}
          </div>
          <Notice/>
        </> : null}

        {screen === "create" ? <>
          <Head tag="Step 1 · Free plan" title="Create your restaurant page"
            note="A real business would create a draft, then verify ownership before publishing. Here you are editing a fictional restaurant only."/>
          <div className="grid gap-5 lg:grid-cols-[1fr_19rem]">
            <section className={card + " space-y-5"}>
              <Field label="Restaurant name" value={restaurant.name} max={80}
                onChange={(name) => setRestaurant({ ...restaurant, name })}/>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bangkok area" value={restaurant.area}
                  onChange={(area) => setRestaurant({ ...restaurant, area })}/>
                <Field label="Cuisine / concept" value={restaurant.cuisine}
                  onChange={(cuisine) => setRestaurant({ ...restaurant, cuisine })}/>
              </div>
              <label className="block space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-white/75">Description</span>
                <textarea className={field} rows={3} maxLength={360} value={restaurant.description}
                  onChange={(event) => setRestaurant({ ...restaurant, description: event.target.value })}/>
              </label>
              <button type="button" className={primary} onClick={() => {
                const error = validateBusinessDraft(restaurant);
                if (error) { toast.error(error); return; }
                toast.success("Demo page created locally");
                go("editor");
              }}><Check size={16}/> Create sample page and edit menu</button>
            </section>
            <aside className={card + " h-fit"}>
              <ShieldCheck size={24} className="text-[#f7aa91]"/>
              <h3 className="mt-4 font-display text-3xl">Ownership first</h3>
              <p className="mt-3 text-sm leading-7 text-white/60">Business pages can be drafted for free. Claiming an existing restaurant or publishing as an official owner will require verification.</p>
            </aside>
          </div>
          <Notice/>
        </> : null}

        {screen === "editor" ? <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Head tag="Step 2 · Free menu" title="Build the menu"
              note="Manage dishes, sections, prices and availability. New dishes and edits remain in this browser tab."/>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primary} onClick={addItem}><Plus size={16}/> Add dish</button>
              <button type="button" className={btn} onClick={() => go("preview")}>Preview <ArrowRight size={16}/></button>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_17rem]">
            <div className="space-y-3">
              {menu.length === 0 ? <p className={card + " text-sm text-white/60"}>Your sample menu is empty. Add a dish to begin.</p> : null}
              {menu.map((item) => <section key={item.id} className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={kicker}>{item.category || "Uncategorized"}</p>
                    <h3 className="mt-1 text-base font-semibold">{item.names.en || "New dish"}</h3>
                    <p className="mt-1 text-xs text-white/55">฿{item.priceThb} · {item.available ? "Visible to guests" : "Hidden"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={btn} aria-expanded={editing === item.id}
                      onClick={() => setEditing(editing === item.id ? null : item.id)}>
                      <Edit3 size={15}/>{editing === item.id ? "Close" : "Edit"}
                    </button>
                    <button type="button" aria-label={"Remove " + (item.names.en || "dish")} className={btn + " px-3"}
                      onClick={() => {
                        setMenu((old) => old.filter((entry) => entry.id !== item.id));
                        if (editing === item.id) setEditing(null);
                        toast.message("Sample dish removed");
                      }}><Trash2 size={16}/></button>
                  </div>
                </div>
                {editing === item.id ? <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Dish name · English" value={item.names.en} onChange={(text) => updateTranslation(item.id,"names","en",text)}/>
                    <Field label="Menu section" value={item.category} onChange={(text) => updateItem(item.id,{category:text})}/>
                    <label className="space-y-2"><span className="block text-xs font-bold uppercase tracking-wide text-white/75">Price in THB</span>
                      <input className={field} type="number" min={0} max={100000} value={item.priceThb}
                        onChange={(event) => updateItem(item.id,{priceThb:Math.max(0,Math.min(100000,Number(event.target.value)||0))})}/>
                    </label>
                    <label className="flex min-h-11 items-center gap-3 self-end border border-white/20 p-3 text-sm text-white/75">
                      <input type="checkbox" checked={item.available} className="h-5 w-5 accent-[#d6321f]"
                        onChange={(event) => updateItem(item.id,{available:event.target.checked})}/> Available on menu
                    </label>
                  </div>
                  <label className="space-y-2"><span className="block text-xs font-bold uppercase tracking-wide text-white/75">Description · English</span>
                    <textarea className={field} rows={2} value={item.descriptions.en} maxLength={240}
                      onChange={(event) => updateTranslation(item.id,"descriptions","en",event.target.value)}/>
                  </label>
                  <div className="border-t border-white/10 pt-4">
                    <p className={kicker}>Multilingual menu</p>
                    {planHasFeature(plan,"ai_translation") ? <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {MENU_LANGUAGES.filter((lang) => lang !== "en").map((lang) =>
                          <button type="button" key={lang} onClick={() => setLanguage(lang)}
                            aria-pressed={language === lang}
                            className={"min-h-10 border px-3 text-xs font-bold " +
                              (language === lang ? "border-[#e15b45] bg-[#e15b45]" : "border-white/20")}>
                            {BUSINESS_LANGUAGE_NAMES[lang]}
                          </button>)}
                      </div>
                      <div className="mt-3 space-y-3">
                        <Field label={"Name · " + BUSINESS_LANGUAGE_NAMES[language === "en" ? "th" : language]}
                          value={item.names[language === "en" ? "th" : language]}
                          onChange={(text) => updateTranslation(item.id,"names",language === "en" ? "th" : language,text)}/>
                        <label className="space-y-2">
                          <span className="block text-xs font-bold uppercase tracking-wide text-white/75">Translated description</span>
                          <textarea className={field} rows={2} maxLength={240}
                            value={item.descriptions[language === "en" ? "th" : language]}
                            onChange={(event) => updateTranslation(item.id,"descriptions",language === "en" ? "th" : language,event.target.value)}/>
                        </label>
                      </div>
                      <p className="mt-3 text-xs leading-6 text-amber-100">Sample translations are prewritten, not generated by AI. For new dishes, enter other languages manually. Real AI translations will require restaurant approval.</p>
                    </> : <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="max-w-lg text-xs leading-6 text-white/60">Free includes menu editing. Pro adds AI-assisted translations, branded QR and multilingual guest access.</p>
                      <button type="button" className={btn} onClick={() => go("plans")}><Crown size={15}/> Preview Pro</button>
                    </div>}
                  </div>
                </div> : null}
              </section>)}
              <button type="button" className={btn + " w-full border-dashed"} onClick={addItem}><Plus size={16}/> Add another dish</button>
            </div>
            <aside className={card + " h-fit space-y-4"}>
              <p className={kicker}>Your current draft</p>
              <p className="font-display text-4xl">{menu.length} <span className="text-sm font-sans text-white/50">dishes</span></p>
              <p className="text-xs leading-6 text-white/65">Guests only see available dishes. Published menu links should remain stable even when a restaurant updates the menu.</p>
              <button type="button" className={primary + " w-full"} onClick={() => go("preview")}>Preview menu</button>
              <button type="button" className={btn + " w-full"} onClick={() => go("qr")}>QR example</button>
              <Notice/>
            </aside>
          </div>
        </> : null}

        {screen === "preview" ? <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Head tag={sample ? "Fixed QR destination" : "Step 3 · Guest menu preview"} title="Menu without an app"
              note="Guests should be able to scan, choose a language and read the menu without creating a diner account."/>
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={() => go("editor")}>Edit draft</button>
              <button type="button" className={btn} onClick={() => go("qr")}>QR menu <QrCode size={16}/></button>
            </div>
          </div>
          <Notice qr={sample}/>
          <div className="mx-auto max-w-3xl overflow-hidden border border-white/10 bg-[#f7f0e6] text-[#292521]">
            <div className="bg-[#2a2926] px-5 py-9 text-white sm:px-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#e6bca2]">{sample ? businessDemoRestaurant.cuisine : restaurant.cuisine}</p>
              <h2 className="mt-3 font-display text-5xl">{sample ? businessDemoRestaurant.name : restaurant.name}</h2>
              <p className="mt-3 flex items-center gap-2 text-sm text-white/70"><MapPin size={15}/>{sample ? businessDemoRestaurant.area : restaurant.area}</p>
              <p className="mt-3 text-sm text-white/65">{sample ? businessDemoRestaurant.description : restaurant.description}</p>
            </div>
            <div className="border-b border-[#d6c9bb] px-5 py-5 sm:px-8">
              <p className="text-xs font-bold text-[#665a4f]">Choose menu language</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(sample ? MENU_LANGUAGES : planHasFeature(plan,"ai_translation") ? MENU_LANGUAGES : ["en","th"] as const).map((lang) =>
                  <button key={lang} type="button" onClick={() => setLanguage(lang)}
                    aria-pressed={language === lang}
                    className={"min-h-10 border px-3 text-xs font-bold " +
                      (language === lang ? "border-[#a83f2c] bg-[#a83f2c] text-white" : "border-[#c9bdb0] text-[#51473d]")}>
                    {BUSINESS_LANGUAGE_NAMES[lang]}
                  </button>)}
              </div>
            </div>
            <div className="px-5 py-6 sm:px-8">
              {Array.from(new Set(availableMenu.map((item) => item.category || "Other"))).map((category) =>
                <section key={category} className="mb-7">
                  <h3 className="border-b border-[#d5c7b7] pb-3 font-display text-3xl">{category}</h3>
                  <div className="divide-y divide-[#ddd1c4]">
                    {availableMenu.filter((item) => (item.category || "Other") === category).map((item) =>
                      <div key={item.id} className="flex gap-4 py-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold">{item.names[language] || item.names.en}</h4>
                          <p className="mt-1 text-sm leading-6 text-[#786c60]">{item.descriptions[language] || item.descriptions.en}</p>
                          {!item.names[language] && language !== "en" ? <p className="mt-1 text-[11px] text-[#a54331]">English fallback — no approved translation</p> : null}
                        </div>
                        <strong className="text-sm">฿{item.priceThb}</strong>
                      </div>)}
                  </div>
                </section>)}
              {!availableMenu.length ? <p className="py-8 text-center text-sm text-[#796f62]">No available dishes in this menu.</p> : null}
            </div>
            <p className="border-t border-[#d6c9bb] p-4 text-center text-[11px] text-[#786e61]">Fictional restaurant · Sample prices and translations · JaanNee demo</p>
          </div>
        </> : null}

        {screen === "qr" ? <>
          <Head tag="Step 4 · QR menu" title="Scan your menu" note="The QR below is scannable. It points to a fixed fictional sample menu, not your browser-only draft."/>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section className={card}>
              <div className="mx-auto flex max-w-sm flex-col items-center gap-4 bg-white p-6 text-center text-[#282421]">
                <h2 className="font-display text-3xl">{businessDemoRestaurant.name}</h2>
                {qr ? <img src={qr} width={300} height={300} alt="QR to the fixed fictional restaurant sample menu"
                  className="h-auto w-full max-w-[300px]"/> : <div className="aspect-square w-full animate-pulse bg-[#efefef]"/>}
                <p className="text-xs font-bold uppercase tracking-widest">Scan to see a demo menu</p>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => go("preview",true)} className={primary}>Open QR destination <ArrowRight size={16}/></button>
                {qr ? <a href={qr} target="_blank" rel="noopener noreferrer" className={btn}>Open SVG to save <QrCode size={16}/></a> : null}
                {destination ? <button type="button" className={btn} onClick={() => {
                  void navigator.clipboard.writeText(destination).then(() => toast.success("Sample URL copied"))
                    .catch(() => toast.error("Clipboard unavailable"));
                }}><Copy size={16}/> Copy sample URL</button> : null}
              </div>
              <div className="mt-5"><Notice qr/></div>
            </section>
            <aside className={card + " h-fit space-y-3"}>
              <QrCode size={24} className="text-[#fb927d]"/>
              <h3 className="font-display text-3xl">A stable code</h3>
              <p className="text-sm leading-7 text-white/65">In production, every restaurant receives a permanent first-party menu URL. Updating a published menu should never require reprinting the QR.</p>
              <p className="text-xs leading-6 text-white/55">Preview QR art is rendered by a third-party service using only the public sample URL; no customer details are submitted.</p>
              {!planHasFeature(plan,"qr_branding") ? <button type="button" className={btn} onClick={() => go("plans")}>Preview branded Pro <Crown size={15}/></button> : null}
            </aside>
          </div>
        </> : null}

        {screen === "plans" ? <>
          <Head tag="Proposed pricing · Not live" title="Start free. Upgrade when useful."
            note="These are unvalidated test prices in THB per restaurant outlet. Selecting a plan only changes this preview. No real checkout or subscription is created."/>
          <div className="grid gap-4 xl:grid-cols-3">
            {(Object.keys(BUSINESS_DEMO_PLANS) as RestaurantPlan[]).map((tier) => {
              const offer = BUSINESS_DEMO_PLANS[tier];
              return <article key={tier} className={card + " flex flex-col " + (tier === "pro" ? "border-[#e65b44]" : "")}>
                <p className={kicker}>{tier === "free" ? "Free forever" : tier === "pro" ? "For international guests" : "For returning customers"}</p>
                <h2 className="mt-2 font-display text-4xl">{offer.name}</h2>
                <p className="mt-4 font-display text-5xl">฿{offer.priceThb.toLocaleString()} <span className="text-xs font-sans text-white/50">/month/outlet</span></p>
                <p className="mt-3 text-sm leading-6 text-white/60">{offer.pitch}</p>
                <div className="mt-5 flex-1 space-y-3 border-t border-white/10 pt-5">
                  {offer.features.map((feature) => <p key={feature} className="flex items-start gap-2 text-sm text-white/75">
                    <Check size={16} className="mt-0.5 shrink-0 text-[#e57c67]"/>{BUSINESS_FEATURE_LABELS[feature]}
                  </p>)}
                </div>
                <button type="button" className={tier === plan ? btn + " mt-7 border-[#ed725a]" : primary + " mt-7"}
                  onClick={() => {
                    setPlan(tier);
                    toast.message(offer.name + " preview selected — no payment was taken");
                    go(tier === "growth" ? "growth" : "editor");
                  }}>{tier === plan ? "Current preview tier" : "Preview " + offer.name} <ArrowRight size={15}/></button>
              </article>;
            })}
          </div>
          <Notice/>
        </> : null}

        {screen === "growth" ? <>
          <Head tag="Growth · Future module" title="Give guests a reason to return"
            note="Vouchers, opt-in loyalty and Sponsored promotions are planned. They must never affect independent dish rankings."/>
          {!planHasFeature(plan,"vouchers") ? <div className={card + " flex flex-wrap items-center justify-between gap-4"}>
            <p className="max-w-xl text-sm leading-7 text-white/65">This is part of the proposed Growth plan. We do not message real users or collect campaign payments in the demo.</p>
            <button type="button" className={primary} onClick={() => go("plans")}>View Growth plan <ArrowRight size={16}/></button>
          </div> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className={card + " space-y-5"}>
              <p className={kicker}>Voucher composer · No sending</p>
              <Field label="Sample voucher title" value={voucherTitle} onChange={setVoucherTitle}/>
              <label className="block space-y-2"><span className="block text-xs font-bold uppercase tracking-wide text-white/70">Sample discount (%)</span>
                <input type="number" min={1} max={90} className={field} value={voucherDiscount}
                  onChange={(event) => setVoucherDiscount(Math.min(90,Math.max(1,Number(event.target.value)||1)))}/>
              </label>
              <p className="text-xs leading-6 text-amber-200">Real campaigns will require explicit diner permission, verified ownership, sending limits, expiry and secure redemption.</p>
              <button type="button" className={btn} onClick={() => toast.message("Preview only — no messages or ads were sent")}>
                <Megaphone size={15}/> Preview campaign only
              </button>
            </div>
            <aside className={card + " h-fit"}>
              <p className={kicker}>Fictional guest offer</p>
              <h3 className="mt-3 font-display text-3xl">{voucherTitle}</h3>
              <p className="mt-4 font-display text-5xl text-[#ffa58c]">{voucherDiscount}% off</p>
              <p className="mt-4 text-xs text-white/50">Sample voucher. No redemption value.</p>
              <div className="mt-5 border-t border-white/10 pt-5">
                <h4 className="text-sm font-bold">Coming next</h4>
                <p className="mt-2 text-sm leading-6 text-white/60">Verified visits, loyalty rewards and clearly labeled Sponsored feed placements.</p>
              </div>
            </aside>
          </div>}
        </> : null}
        <footer className="border-t border-white/10 pt-5 text-xs leading-6 text-white/40">JaanNee · Business concept demo only · One identity system with different diner and business experiences in production.</footer>
      </main>
    </div>
    <nav aria-label="Business quick navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/15 bg-[#191817]/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      {[
        {key:"home" as Screen,name:"Home",Icon:Store},
        {key:"editor" as Screen,name:"Menu",Icon:BookOpen},
        {key:"qr" as Screen,name:"QR",Icon:QrCode},
        {key:"plans" as Screen,name:"Plans",Icon:Crown},
      ].map(({key,name,Icon}) => <button key={key} type="button" onClick={() => go(key)}
        className={"flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-bold " +
          (screen === key ? "text-[#f6826d]" : "text-white/65")}>
        <Icon size={19}/>{name}
      </button>)}
    </nav>
  </div>;
}
