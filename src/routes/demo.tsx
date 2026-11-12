import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Bookmark, Check, Coffee, Compass, Heart,
  MapPin, RotateCcw, Search, Share2, Sparkles, Trophy, UserRound,
  Users, UtensilsCrossed, Store, X,
} from "lucide-react";
import { toast } from "sonner";
import { DemoSocialPreview } from "@/components/DemoSocialPreview";
import { canCompareDemoDishes, countTrustedDemoPicks, discoverTrustedDemoDishes } from "@/lib/demo-discovery";
import {
  DEMO_DISCLAIMER, demoAreas, demoCategories, demoDishes,
  demoPeople, demoRestaurants, filterDemoDishes, rankDemoDishes,
  restaurantFor, type DemoDish, type DemoPerson, type DemoRestaurant,
} from "@/lib/demo-data";

type View = "discover" | "rankings" | "people" | "dish" | "place" | "profile" | "saved" | "me";
type DemoSearch = { view?: View; id?: string; classic?: boolean };
type DemoNavigation = (view: View, id?: string) => void;
const allViews: View[] = ["discover", "rankings", "people", "dish", "place", "profile", "saved", "me"];
const border = "border border-white/10 bg-white/[0.035]";
const caption = "text-[10px] font-bold uppercase tracking-[0.17em]";
const buttonStyle = "inline-flex min-h-11 items-center justify-center gap-2 border border-white/25 px-4 py-2 text-xs font-bold uppercase tracking-wide transition hover:border-[#ff674f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f45a45]";

export const Route = createFileRoute("/demo")({
  validateSearch: (search: Record<string, unknown>): DemoSearch => ({
    view: typeof search.view === "string" && allViews.includes(search.view as View)
      ? search.view as View : "discover",
    id: typeof search.id === "string" ? search.id.slice(0, 80) : undefined,
    classic: search.classic === true || search.classic === 1 || search.classic === "1" || search.classic === "true",
  }),
  head: () => ({
    meta: [
      { title: "JaanNee demo — fictional Bangkok food discovery" },
      { name: "description", content: "Explore a database-free demonstration with fictional restaurants, diners, example rankings and sample dishes." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: DemoRouteExperience,
});

function setMembership(items: Set<string>, item: string) {
  const next = new Set(items);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

function Photo({ dish, className = "" }: { dish: DemoDish; className?: string }) {
  return <img src={dish.image} alt={"Illustrative food photograph for " + dish.name}
    className={className} loading="lazy" referrerPolicy="no-referrer" />;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className={caption + " text-[#fa715b]"}>{children}</p>;
}

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="max-w-3xl">
    <Label>{eyebrow}</Label>
    <h2 className="mt-2 font-display text-4xl leading-[1.0] md:text-5xl">{title}</h2>
    {description ? <p className="mt-3 text-sm leading-6 text-white/60">{description}</p> : null}
  </div>;
}

function Pill({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick}
    className={"min-h-10 shrink-0 border px-4 text-xs font-bold transition-colors " +
      (selected ? "border-[#e44c36] bg-[#e44c36] text-white" : "border-white/20 text-white/70 hover:border-white/60")}>
    {children}
  </button>;
}

function Avatar({ person }: { person: DemoPerson }) {
  return <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-2xl text-white"
    style={{ background: person.color }}>{person.initials}</span>;
}

function SampleDishCard({
  dish, navigate, saved, toggleSave, trustedCount = 0,
}: {
  dish: DemoDish; navigate: DemoNavigation; saved: boolean; toggleSave: (id: string) => void;
  trustedCount?: number;
}) {
  const place = restaurantFor(dish);
  return <article className={border + " group relative flex flex-col overflow-hidden"}>
    <button type="button" onClick={() => navigate("dish", dish.id)} className="relative aspect-[5/4] overflow-hidden bg-[#28231e] text-left">
      <Photo dish={dish} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
      <span className="absolute left-3 top-3 bg-[#151414]/85 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">Demo dish</span>
      <span className="absolute bottom-3 left-3 bg-black/75 px-2.5 py-1 text-xs font-bold">Sample score {dish.score}</span>
    </button>
    <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
      <p className={caption + " truncate text-[#f67b65]"}>{dish.category}</p>
      <button type="button" onClick={() => navigate("dish", dish.id)}
        className="min-h-12 text-left font-display text-xl leading-tight hover:text-[#fb725d] sm:text-[1.75rem]">{dish.name}</button>
      <button type="button" onClick={() => navigate("place", place.id)}
        className="line-clamp-2 text-left text-xs leading-5 text-white/65 hover:text-white">{place.name} · {place.area}</button>
      {trustedCount > 0 ? <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
        <Heart size={13} aria-hidden="true" />
        {trustedCount} {trustedCount === 1 ? "pick" : "picks"} from your circle
      </p> : null}
      <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-sm font-semibold">฿{dish.price}<span className="ml-2 hidden text-[10px] font-normal text-white/40 sm:inline">sample price</span></span>
        <button type="button" onClick={() => toggleSave(dish.id)} aria-label={saved ? "Unsave demo dish" : "Save demo dish"}
          aria-pressed={saved} className="grid h-10 w-10 place-items-center border border-white/20 text-white hover:border-[#f45a45]">
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  </article>;
}

function DemoRouteExperience() {
  const { view = "discover", classic } = Route.useSearch();
  // The responsive social news feed is now the default /demo experience.
  // All eight original interactive demo views remain accessible.
  return view === "discover" && !classic ? <DemoSocialPreview /> : <DemoExperience />;
}

function DemoExperience() {
  const { view = "discover", id } = Route.useSearch();
  const navigate = useNavigate({ from: "/demo" });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [showCount, setShowCount] = useState(12);
  const [showFriendsOnly, setShowFriendsOnly] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [tried, setTried] = useState<Set<string>>(() => new Set());
  const [recommended, setRecommended] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState<Set<string>>(() => new Set(["nina_eats", "ton_tastes"]));
  const [editingPick, setEditingPick] = useState(false);
  const [pickNote, setPickNote] = useState("");
  const [comparison, setComparison] = useState<string | null>(null);

  const go: DemoNavigation = (nextView, nextId) => {
    setEditingPick(false);
    setComparison(null);
    void navigate({ to: "/demo", search: { view: nextView, id: nextId } });
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  const toggleSaved = (dishId: string) => {
    setSaved((current) => setMembership(current, dishId));
    toast.message(saved.has(dishId) ? "Removed from demo saved dishes" : "Saved in this demo session");
  };

  const toggleTried = (dishId: string) => {
    setComparison(null);
    setTried((current) => setMembership(current, dishId));
    if (tried.has(dishId)) {
      setRecommended((current) => {
        const next = { ...current };
        delete next[dishId];
        return next;
      });
      setEditingPick(false);
    }
    toast.message(tried.has(dishId) ? "Removed demo tried mark and recommendation" : "Marked as tried (demo only)");
  };

  const toggleFollow = (username: string) => {
    setFollowing((current) => setMembership(current, username));
    toast.message(following.has(username) ? "Unfollowed (demo only)" : "Followed (demo only)");
  };

  const savePick = (dishId: string) => {
    if (!tried.has(dishId)) {
      toast.error("Mark this dish as tried first");
      return;
    }
    setRecommended((current) => ({ ...current, [dishId]: pickNote.trim().slice(0, 180) }));
    setEditingPick(false);
    toast.success("Sample recommendation saved");
  };

  const reset = () => {
    setSaved(new Set());
    setTried(new Set());
    setFollowing(new Set(["nina_eats", "ton_tastes"]));
    setRecommended({});
    setEditingPick(false);
    setComparison(null);
    setCategory("");
    setArea("");
    setSearch("");
    setShowCount(12);
    setShowFriendsOnly(false);
    toast.message("Demo reset — no real account or database was changed");
  };

  async function share(nextView: View, nextId: string) {
    const url = new URL("/demo", window.location.origin);
    url.searchParams.set("view", nextView);
    url.searchParams.set("id", nextId);
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("Demo-only link copied");
    } catch {
      toast.error("Copy unavailable; use your browser's address bar");
    }
  }

  const matching = useMemo(
    () => filterDemoDishes(demoDishes, { category, area, query: search }),
    [search, category, area],
  );
  const trustedCounts = useMemo(
    () => countTrustedDemoPicks(demoPeople, following),
    [following],
  );
  const personalMatches = useMemo(
    () => discoverTrustedDemoDishes(matching, trustedCounts),
    [matching, trustedCounts],
  );
  const visibleDishes = showFriendsOnly ? personalMatches : rankDemoDishes(matching);
  const jumpToResults = () => {
    document.getElementById("demo-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const dish = demoDishes.find((entry) => entry.id === id);
  const restaurant = demoRestaurants.find((entry) => entry.id === id);
  const profile = demoPeople.find((entry) => entry.username === id);
  const myPicks = demoDishes.filter((item) => Object.prototype.hasOwnProperty.call(recommended, item.id));
  const trusted = demoPeople
    .filter((person) => following.has(person.username))
    .flatMap((person) => person.picks.map((pick) => ({
      person, note: pick.note, dish: demoDishes.find((item) => item.id === pick.dishId)!,
    })));

  const nav = [
    { view: "discover" as View, label: "Discover", icon: Compass },
    { view: "rankings" as View, label: "Rankings", icon: Trophy },
    { view: "people" as View, label: "People", icon: Users },
    { view: "saved" as View, label: "Saved", icon: Bookmark },
    { view: "me" as View, label: "My picks", icon: UserRound },
  ];

  const filters = <div className="mt-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex min-h-11 items-center gap-2 border border-white/20 px-3 text-xs text-white/75">
        <MapPin size={16} aria-hidden="true" />
        <span>Area</span>
        <select value={area} onChange={(event) => { setArea(event.target.value); setShowCount(12); }}
          aria-label="Bangkok sample area" className="max-w-44 bg-[#1c1b1b] px-2 py-2 text-xs text-white">
          <option value="">All Bangkok</option>
          {demoAreas.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
      </label>
      {(category || area || search) ? <button type="button" onClick={() => { setCategory(""); setArea(""); setSearch(""); setShowCount(12); }}
        className="min-h-10 text-xs font-bold uppercase tracking-wider text-[#f87564]">Clear filters <X className="ml-1 inline" size={14}/></button> : null}
    </div>
    <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Dish category filters">
      <Pill selected={!category} onClick={() => { setCategory(""); setShowCount(12); }}>All dishes</Pill>
      {demoCategories.map((item) => <Pill key={item} selected={category === item} onClick={() => { setCategory(category === item ? "" : item); setShowCount(12); }}>{item}</Pill>)}
    </div>
  </div>;

  return <div className="noir-theme min-h-screen bg-[#131211] pb-24 text-[#faf8f4] md:pb-0">
    <div className="border-b border-amber-300/30 bg-[#3b281b] px-4 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-amber-100 sm:text-xs">
      {DEMO_DISCLAIMER}
    </div>
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#171615]/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[92rem] items-center justify-between gap-4 px-4 sm:px-7">
        <button type="button" onClick={() => go("discover")} aria-label="Open JaanNee demo homepage"
          className="flex items-center gap-2 text-left"><span className="h-8 w-1 bg-[#df4530]"/><span className="font-display text-3xl">JaanNee</span><span className="self-start text-[9px] font-black uppercase tracking-widest text-amber-300">Demo</span></button>
        <nav aria-label="Demo navigation" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = view === item.view || (item.view === "discover" && (view === "dish" || view === "place")) ||
              (item.view === "people" && view === "profile");
            return <button key={item.view} type="button" onClick={() => go(item.view)}
              aria-current={active ? "page" : undefined}
              className={"inline-flex min-h-11 items-center gap-2 px-3 text-xs font-bold uppercase tracking-wide " +
                (active ? "text-[#fb735f]" : "text-white/65 hover:text-white")}>
              <Icon size={16}/>{item.label}
            </button>;
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/demo" search={{ view: "discover" }}
            className="inline-flex min-h-10 items-center gap-1.5 border border-amber-300/50 px-3 text-[11px] font-bold uppercase tracking-wide text-amber-200 hover:bg-white/10">
            New social feed
          </Link>
          <Link to="/demo-business" search={{ screen: "home" }}
            className="inline-flex min-h-10 items-center gap-1.5 border border-[#f77b61]/70 px-2 text-[11px] font-bold uppercase tracking-wide text-[#ffa38d] hover:bg-white/10 sm:px-3">
            <Store size={15}/><span className="hidden sm:inline">For restaurants</span><span className="sm:hidden">Business</span>
          </Link>
          <button type="button" onClick={reset} className={buttonStyle + " min-h-10 px-2 sm:px-3"}>
            <RotateCcw size={14}/><span className="hidden lg:inline">Reset demo</span>
          </button>
        </div>
      </div>
    </header>

    <main className="mx-auto min-h-[75vh] max-w-[92rem]">
      {view === "discover" ? <>
        <section className="grid border-b border-white/10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative flex min-h-[22rem] flex-col justify-center overflow-hidden px-5 py-10 sm:px-9 lg:min-h-[31rem] lg:px-12 lg:py-14">
            <Photo dish={demoDishes[8]} className="absolute inset-0 h-full w-full object-cover opacity-[0.23] lg:hidden" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#111]/80 via-[#111]/65 to-[#111]/60 lg:hidden" />
            <div className="relative z-10">
            <Label>Bangkok, dish by dish · Interactive preview</Label>
            <h1 className="mt-5 max-w-3xl font-display text-[clamp(3.6rem,8vw,8.5rem)] leading-[0.9] tracking-[-0.05em]">
              What are you <em className="text-[#e45540]">craving?</em>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/65">
              Find the dish, not just the restaurant. Compare sample rankings and discover picks from people you follow.
            </p>
            <label className="relative mt-7 block max-w-xl">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50"/>
              <span className="sr-only">Search sample food, restaurants and areas</span>
              <input type="search" placeholder="Search pad kra pao, noodles, Ari…" value={search}
                onChange={(event) => { setSearch(event.target.value); setShowCount(12); }}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); jumpToResults(); } }}
                className="h-14 w-full border border-white/25 bg-[#141313]/85 pl-12 pr-4 text-base text-white outline-none placeholder:text-white/50 focus:border-[#f76e58]"/>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["Pad Kra Pao", "Khao Soi", "Specialty Coffee"] as const).map((item) => (
                <button type="button" key={item} onClick={() => { setCategory(item); setShowCount(12); jumpToResults(); }}
                  className="min-h-10 border border-white/30 bg-black/45 px-3 text-xs font-semibold text-white hover:border-[#e85f4a]">
                  {item}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/60">40 fictional dishes · 10 fictional venues · 6 sample diners</p>
            <button type="button" onClick={jumpToResults} className="mt-4 inline-flex min-h-11 items-center gap-2 border-b border-white/60 text-xs font-bold uppercase tracking-wide text-white hover:border-[#ff7964] hover:text-[#ff7964]">
              See the dishes <ArrowRight size={16}/>
            </button>
            </div>
          </div>
          <button type="button" onClick={() => go("dish", "khao-soi-chicken")}
            className="group relative hidden min-h-[31rem] overflow-hidden bg-[#241c17] text-left lg:block">
            <Photo dish={demoDishes[8]} className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.03]"/>
            <span className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent"/>
            <span className="absolute bottom-9 left-9 right-9">
              <span className={caption + " text-amber-200"}>Featured sample</span>
              <span className="mt-2 block font-display text-5xl">Coconut Chicken Khao Soi</span>
              <span className="mt-3 inline-flex items-center gap-2 border-b border-white text-xs font-bold uppercase tracking-widest">See the dish <ArrowRight size={15}/></span>
            </span>
          </button>
        </section>

        <section id="demo-filters" className="border-b border-white/10 px-4 py-7 sm:px-8 sm:py-9">
          <Heading eyebrow="Find your next meal" title="Browse by dish and area" description="Search by food, cuisine, restaurant concept or Bangkok neighborhood."/>
          {filters}
        </section>

        <section id="demo-results" className="scroll-mt-24 px-4 py-10 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Heading eyebrow="The catalog" title={search || category || area ? "Your search results" : "Dishes worth discovering"}
              description={showFriendsOnly
                ? "Only explicit sample recommendations from diners you follow. These are not ranking votes."
                : "Scores, prices and photos are illustrative; sort order is a sample leaderboard."}/>
            <p role="status" aria-live="polite" className="text-xs text-white/55">
              {visibleDishes.length} {visibleDishes.length === 1 ? "dish" : "dishes"} shown
            </p>
            <button type="button" onClick={() => go("rankings")} className={buttonStyle}>View sample rankings <ArrowRight size={16}/></button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Discovery preference">
            <Pill selected={!showFriendsOnly} onClick={() => { setShowFriendsOnly(false); setShowCount(12); }}>
              All dishes
            </Pill>
            <Pill selected={showFriendsOnly} onClick={() => { setShowFriendsOnly(true); setShowCount(12); }}>
              From my circle ({personalMatches.length})
            </Pill>
            {showFriendsOnly ? <button type="button" className="min-h-10 px-3 text-xs font-semibold text-[#f8927f] hover:text-white"
              onClick={() => go("people")}>Manage follows <ArrowRight size={13} className="inline"/></button> : null}
          </div>
          {visibleDishes.length ? <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {visibleDishes.slice(0, showCount).map((item) =>
                <SampleDishCard key={item.id} dish={item} navigate={go} saved={saved.has(item.id)}
                  trustedCount={trustedCounts.get(item.id) ?? 0} toggleSave={toggleSaved}/>)}
            </div>
            {visibleDishes.length > showCount ? <button type="button" onClick={() => setShowCount(showCount + 12)} className={buttonStyle + " mt-7 w-full"}>
              Show more dishes ({visibleDishes.length - showCount} remaining)
            </button> : null}
          </> : <div className={border + " mt-6 p-8 text-center"}>
            <Search className="mx-auto text-white/40" size={28}/>
            <h3 className="mt-3 font-display text-3xl">No matches found</h3>
            <p className="mt-2 text-sm text-white/60">
              {showFriendsOnly ? "None of the people you follow recommended a dish matching these filters." : "Try another search or reset the filters."}
            </p>
            <button type="button" onClick={() => { setSearch(""); setCategory(""); setArea(""); setShowFriendsOnly(false); }}
              className={buttonStyle + " mt-4"}>Show all sample dishes</button>
          </div>}
        </section>

        {!search && !category && !area ? <section className="border-b border-white/10 bg-[#1b1917] px-4 py-10 sm:px-8">
          <Heading eyebrow="The social layer" title="Picks from people you trust"
            description="A recommendation is an intentional endorsement, not just a tried mark. All diners and endorsements below are fictional."/>
          {demoPeople.some((person) => following.has(person.username)) ? <div className="mt-6 grid gap-4 md:grid-cols-3">
            {demoPeople.filter((person) => following.has(person.username)).slice(0, 3).map((person) => {
              const pick = person.picks[0];
              const sample = demoDishes.find((item) => item.id === pick.dishId)!;
              return <article key={person.username} className={border + " flex flex-col overflow-hidden"}>
                <button type="button" onClick={() => go("dish", sample.id)} className="relative aspect-[16/9] overflow-hidden text-left">
                  <Photo dish={sample} className="h-full w-full object-cover"/>
                  <span className="absolute bottom-3 left-3 bg-black/75 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">Fictional pick</span>
                </button>
                <div className="flex flex-1 flex-col p-5">
                  <button type="button" onClick={() => go("profile", person.username)} className="flex items-center gap-3 text-left">
                    <Avatar person={person}/>
                    <span className="text-sm font-semibold">{person.name}<span className="block text-xs font-normal text-white/45">@{person.username}</span></span>
                  </button>
                  <button type="button" onClick={() => go("dish", sample.id)} className="mt-4 text-left font-display text-3xl hover:text-[#fb725d]">{sample.name}</button>
                  <p className="mt-2 flex-1 text-sm leading-6 text-white/65">“{pick.note}”</p>
                  <button type="button" onClick={() => toggleFollow(person.username)}
                    className={buttonStyle + " mt-5 w-full " + (following.has(person.username) ? "border-[#eb5a42] text-[#ff8c79]" : "")}>
                    {following.has(person.username) ? <Check size={15}/> : <Users size={15}/>}
                    {following.has(person.username) ? "Following in demo" : "Follow in demo"}
                  </button>
                </div>
              </article>;
            })}
          </div> : <EmptyState title="Your demo circle is empty"
            message="Follow fictional diners to see their deliberate recommendations here."
            action="Explore people" onClick={() => go("people")}/>}
        </section> : null}

        {!search && !category && !area ? <section className="border-t border-white/10 bg-[#191817] px-4 py-10 sm:px-8">
          <Heading eyebrow="The neighborhoods" title="Meet the places" description="Explore fictional venue pages and sample dishes without connecting to any real restaurant."/>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {demoRestaurants.slice(0, 5).map((item) => <button type="button" key={item.id} onClick={() => go("place", item.id)}
              className={border + " group p-5 text-left hover:border-[#e45a44]"}>
              <MapPin size={17} className="text-[#f36e58]"/>
              <p className="mt-7 font-display text-2xl group-hover:text-[#fb725d]">{item.name}</p>
              <p className="mt-1 text-xs text-white/50">{item.area} · {item.subtitle}</p>
            </button>)}
          </div>
        </section> : null}
      </> : null}

      {view === "rankings" ? <section className="px-4 py-10 sm:px-8 md:py-14">
        <Heading eyebrow="Simulated leaderboard" title="The dish. Not the restaurant."
          description="These are illustrative comparison counts and scores for UX testing, not actual diner votes."/>
        <div className="mt-7 flex gap-2 overflow-x-auto pb-2">
          <Pill selected={!category} onClick={() => setCategory("")}>All dishes</Pill>
          {demoCategories.map((item) => <Pill key={item} selected={category === item} onClick={() => setCategory(item)}>{item}</Pill>)}
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_18rem]">
          <div className={border}>
            {rankDemoDishes(demoDishes.filter((item) => !category || item.category === category)).slice(0, 20).map((item, index) => (
              <button type="button" onClick={() => go("dish", item.id)} key={item.id}
                className="flex w-full items-center gap-3 border-b border-white/10 p-3 text-left hover:bg-white/[0.06] last:border-0 sm:gap-5 sm:p-4">
                <span className="w-8 shrink-0 text-center font-display text-4xl text-[#cba34e] sm:w-12">{index + 1}</span>
                <div className="h-16 w-16 shrink-0 overflow-hidden bg-white/10 sm:h-20 sm:w-24"><Photo dish={item} className="h-full w-full object-cover"/></div>
                <div className="min-w-0 flex-1"><h3 className="font-semibold sm:text-lg">{item.name}</h3>
                  <p className="mt-1 text-xs text-white/55">{item.category} · {restaurantFor(item).name}</p>
                  <p className="mt-1 text-xs text-white/40">{item.comparisons} simulated comparisons</p>
                </div>
                <div className="hidden text-right sm:block"><strong className="block font-display text-3xl text-[#f76b57]">{item.score}</strong><span className="text-[10px] uppercase text-white/45">Demo score</span></div>
                <ArrowRight size={16} className="text-white/50"/>
              </button>
            ))}
          </div>
          <aside className={border + " self-start p-6"}>
            <Trophy className="text-[#d6ae62]" size={23}/>
            <h3 className="mt-4 font-display text-3xl">Why comparisons matter</h3>
            <p className="mt-3 text-sm leading-6 text-white/65">Real JaanNee rankings are meant to reflect head-to-head preferences from diners who tried both dishes in the same category.</p>
            <p className="mt-4 border-l-2 border-[#e55d46] pl-3 text-xs leading-5 text-white/65">Personal recommendations never change the ranking calculations.</p>
          </aside>
        </div>
      </section> : null}

      {view === "people" ? <section className="px-4 py-10 sm:px-8 md:py-14">
        <Heading eyebrow="Demo community" title="Find people with your taste"
          description="Follow these six fictional diners to change which explicit recommendations appear in your demo feed."/>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demoPeople.map((person) => <article key={person.username} className={border + " flex flex-col p-6"}>
            <button type="button" onClick={() => go("profile", person.username)} className="flex items-center gap-3 text-left">
              <Avatar person={person}/><span><strong className="block">{person.name}</strong><span className="block text-xs text-white/45">@{person.username}</span></span>
            </button>
            <p className="mt-5 flex-1 text-sm leading-6 text-white/65">{person.bio}</p>
            <p className="mt-3 text-xs text-[#f88b79]">{person.picks.length} explicit sample picks</p>
            <div className="mt-5 flex gap-2"><button type="button" className={buttonStyle + " flex-1"} onClick={() => toggleFollow(person.username)}>
              {following.has(person.username) ? "Following" : "Follow"}
            </button><button type="button" className={buttonStyle} onClick={() => go("profile", person.username)}>Profile <ArrowRight size={14}/></button></div>
          </article>)}
        </div>
      </section> : null}

      {view === "dish" ? (dish ? <section className="pb-12">
        <div className="relative min-h-[25rem] overflow-hidden bg-[#28221e] sm:min-h-[34rem]">
          <Photo dish={dish} className="absolute inset-0 h-full w-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10"/>
          <button type="button" onClick={() => go("discover")} className="absolute left-4 top-5 inline-flex h-11 w-11 items-center justify-center border border-white/40 bg-black/60" aria-label="Back to discovery"><ArrowLeft size={19}/></button>
          <div className="absolute bottom-0 px-5 pb-8 sm:px-9">
            <Label>{dish.category} · Sample dish</Label>
            <h1 className="mt-3 max-w-4xl font-display text-[clamp(3.6rem,8vw,7rem)] leading-[0.85]">{dish.name}</h1>
            <p className="mt-3 text-sm text-white/80">{dish.nameTh}</p>
            <button type="button" onClick={() => go("place", dish.restaurantId)} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:text-[#ff8a76]">
              <MapPin size={15}/>{restaurantFor(dish).name} · {restaurantFor(dish).area}
            </button>
          </div>
        </div>
        <div className="grid gap-10 px-5 py-9 sm:px-9 lg:grid-cols-[1fr_20rem]">
          <div>
            <Label>The plate</Label><h2 className="mt-2 font-display text-3xl">What makes it interesting</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/70">{dish.description}</p>
            <div className="mt-6 flex flex-wrap gap-5 border-y border-white/10 py-4">
              <Stat label="Sample price" value={"฿" + dish.price}/>
              <Stat label="Demo score" value={String(dish.score)}/>
              <Stat label="Sample comparisons" value={String(dish.comparisons)}/>
            </div>
            <div className="mt-7 flex flex-wrap gap-2">
              <button type="button" onClick={() => toggleTried(dish.id)} className={buttonStyle + (tried.has(dish.id) ? " border-[#e65e48]" : "")}>
                <Check size={17}/>{tried.has(dish.id) ? "Tried · Remove mark" : "I've tried this"}
              </button>
              <button type="button" onClick={() => toggleSaved(dish.id)} className={buttonStyle}>
                <Bookmark size={16} fill={saved.has(dish.id) ? "currentColor" : "none"}/>{saved.has(dish.id) ? "Saved" : "Want to try"}
              </button>
              <button type="button" onClick={() => void share("dish", dish.id)} className={buttonStyle}><Share2 size={16}/>Share demo link</button>
            </div>

            {tried.has(dish.id) ? <div className={border + " mt-7 p-6"}>
              <div className="flex items-center gap-3"><Heart size={19} className="text-[#f87664]"/><h3 className="font-display text-3xl">Would you recommend it?</h3></div>
              <p className="mt-2 text-sm leading-6 text-white/65">A tried mark is not an endorsement. Choose to recommend deliberately; this is saved only in your demo session.</p>
              {Object.prototype.hasOwnProperty.call(recommended, dish.id) && !editingPick ? <div className="mt-4 border-l-2 border-[#ef6b52] bg-white/5 p-4">
                <p className="text-xs font-bold text-[#f88b79]">Your sample pick</p>
                <p className="mt-1 text-sm">{recommended[dish.id] || "Recommended without a note"}</p>
              </div> : null}
              {editingPick ? <div className="mt-5">
                <label className="text-sm font-semibold" htmlFor="pick-note">Why would you recommend it? (optional)</label>
                <textarea id="pick-note" rows={3} maxLength={180} value={pickNote} onChange={(event) => setPickNote(event.target.value)}
                  className="mt-2 w-full border border-white/25 bg-black/40 p-3 text-sm text-white outline-none focus:border-[#fa7761]" placeholder="What would you tell a friend?"/>
                <p className="mt-1 text-right text-xs text-white/45">{pickNote.length}/180</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => savePick(dish.id)} className={buttonStyle + " bg-[#d6321f]"}>Save sample pick</button>
                  <button type="button" onClick={() => setEditingPick(false)} className={buttonStyle}>Cancel</button>
                </div>
              </div> : <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setEditingPick(true); setPickNote(recommended[dish.id] ?? ""); }} className={buttonStyle}>
                  <Heart size={16}/>{Object.prototype.hasOwnProperty.call(recommended, dish.id) ? "Edit my pick" : "Recommend this dish"}
                </button>
                {Object.prototype.hasOwnProperty.call(recommended, dish.id) ? <button type="button" className={buttonStyle} onClick={() => {
                  setRecommended((current) => { const next = { ...current }; delete next[dish.id]; return next; });
                  toast.message("Recommendation removed from demo");
                }}>Remove pick</button> : null}
              </div>}
            </div> : <p className="mt-4 text-sm text-white/50">Mark the dish as tried to unlock the personal recommendation action.</p>}

            <section className="mt-10">
              <Heading eyebrow="People you follow" title="The trusted angle" description="Only intentional recommendations are shown here. Fictional social proof does not affect the leaderboard."/>
              <div className="mt-5 space-y-3">
                {trusted.filter((pick) => pick.dish.id === dish.id).length ? trusted.filter((pick) => pick.dish.id === dish.id).map((pick) =>
                  <button key={pick.person.username} type="button" onClick={() => go("profile", pick.person.username)}
                    className={border + " flex w-full items-start gap-3 p-4 text-left hover:border-[#e66550]"}>
                    <Avatar person={pick.person}/><span><strong>{pick.person.name} recommends this</strong><span className="mt-1 block text-sm text-white/60">“{pick.note}”</span></span>
                  </button>
                ) : <p className={border + " p-4 text-sm text-white/60"}>No people you follow have selected this as a sample pick. Explore the People tab to follow more diners.</p>}
              </div>
            </section>

            {demoDishes.filter((other) => other.category === dish.category && other.id !== dish.id).length ? <section className="mt-10">
              <Heading eyebrow="Try the interaction" title="Head-to-head comparison" description="The real ranking flow only allows comparisons between two dishes you have tried. Here, no vote is sent and scores never change."/>
              {(() => {
                const opponent = demoDishes.find((other) => other.category === dish.category && other.id !== dish.id)!;
                const eligible = canCompareDemoDishes(dish, opponent, tried);
                return <div className={border + " mt-5 p-4 sm:p-5"}>
                  <p className="text-sm text-white/65">{dish.name} <span className="px-2 font-bold text-[#fa7761]">VS</span> {opponent.name}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[dish, opponent].map((option) => (
                      <div key={option.id} className={"overflow-hidden border " + (comparison === option.id ? "border-[#f65a42]" : "border-white/15")}>
                        <Photo dish={option} className="aspect-[4/3] w-full object-cover"/>
                        <div className="flex flex-col gap-2 p-3">
                          <p className="min-h-10 text-xs font-semibold leading-5 sm:text-sm">{option.name}</p>
                          {tried.has(option.id) ? (
                            <p className="inline-flex min-h-9 items-center gap-1 text-xs text-emerald-300"><Check size={14}/> Marked tried</p>
                          ) : (
                            <button type="button" onClick={() => toggleTried(option.id)}
                              className="min-h-10 border border-[#f56b54]/50 px-2 text-xs font-semibold hover:bg-white/10">
                              Mark tried (demo)
                            </button>
                          )}
                          {eligible ? (
                            <button type="button" onClick={() => setComparison(option.id)}
                              aria-pressed={comparison === option.id}
                              className={"min-h-11 px-2 text-xs font-bold uppercase tracking-wide " +
                                (comparison === option.id ? "bg-[#e4523b] text-white" : "bg-white/15 text-white hover:bg-[#e4523b]")}>
                              {comparison === option.id ? "Chosen" : "Prefer this"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!eligible ? (
                    <p role="status" className="mt-4 border-l-2 border-amber-300/75 bg-amber-300/5 p-3 text-sm leading-6 text-amber-100">
                      To compare fairly, first mark both dishes as tried. This only changes your temporary demo state.
                    </p>
                  ) : comparison ? (
                    <p role="status" className="mt-4 border-l-2 border-[#f8917e] p-3 text-sm text-[#f8917e]">
                      Sample preference recorded in this browser tab only. No real vote was sent or ranking changed.
                    </p>
                  ) : (
                    <p className="mt-4 text-xs text-white/60">You've tried both. Choose your favorite to preview the vote flow.</p>
                  )}
                  {comparison ? <button type="button" className={buttonStyle + " mt-4"} onClick={() => setComparison(null)}>Choose again</button> : null}
                </div>;
              })()}
            </section> : null}
          </div>
          <aside className={border + " h-fit p-6"}>
            <Label>About the restaurant</Label><h3 className="mt-3 font-display text-3xl">{restaurantFor(dish).name}</h3>
            <p className="mt-2 text-sm text-white/60">{restaurantFor(dish).intro}</p>
            <button type="button" onClick={() => go("place", dish.restaurantId)} className={buttonStyle + " mt-5 w-full"}>Explore sample venue <ArrowRight size={16}/></button>
            <div className="mt-7 border-t border-white/10 pt-5 text-xs leading-5 text-amber-200">Fictional venue. Illustrative food image and sample menu pricing.</div>
          </aside>
        </div>
      </section> : <Missing onBack={() => go("discover")}/>) : null}

      {view === "place" ? (restaurant ? <PlacePage restaurant={restaurant} navigate={go} saved={saved} toggleSaved={toggleSaved}/> : <Missing onBack={() => go("discover")}/>) : null}
      {view === "profile" ? (profile ? <ProfilePage person={profile} navigate={go} following={following.has(profile.username)}
        toggleFollow={() => toggleFollow(profile.username)} share={() => void share("profile", profile.username)}/>
        : <Missing onBack={() => go("people")}/>) : null}

      {view === "saved" ? <section className="px-4 py-10 sm:px-8 md:py-14">
        <Heading eyebrow="Your session" title="Want to try" description="Bookmarks are stored only in this open page. Refreshing or leaving the demo clears them."/>
        {saved.size ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {demoDishes.filter((item) => saved.has(item.id)).map((item) =>
            <SampleDishCard key={item.id} dish={item} navigate={go} saved={true} toggleSave={toggleSaved}/>)}
        </div> : <EmptyState title="No saved dishes yet" message="Browse Discover, open a dish and tap Want to try to build your sample shortlist."
          action="Discover dishes" onClick={() => go("discover")}/>}
      </section> : null}

      {view === "me" ? <section className="px-4 py-10 sm:px-8 md:py-14">
        <Heading eyebrow="Your demo account" title="My tasting journal"
          description="There is no real user account behind this preview. Trying, following and recommending are session-only actions."/>
        <div className="mt-7 grid grid-cols-3 gap-3">
          <Stat label="Tried" value={String(tried.size)}/>
          <Stat label="Recommended" value={String(myPicks.length)}/>
          <Stat label="Saved" value={String(saved.size)}/>
        </div>
        <div className="mt-10"><Heading eyebrow="Intentional endorsements" title="My picks"
          description="Your recommendations are separate from tried marks and independent of community scores."/></div>
        {myPicks.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myPicks.map((item) => <div key={item.id} className={border + " overflow-hidden"}>
            <button type="button" className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/5" onClick={() => go("dish", item.id)}>
              <div className="h-20 w-20 shrink-0 overflow-hidden"><Photo dish={item} className="h-full w-full object-cover"/></div>
              <div><h3 className="font-semibold">{item.name}</h3><p className="mt-2 text-xs text-white/60">{recommended[item.id] || "Recommended without a note"}</p></div>
            </button>
          </div>)}
        </div> : <EmptyState title="Your public-style picks begin here" message="Mark any demo dish as tried, then deliberately recommend it with an optional note."
          action="Find a dish" onClick={() => go("discover")}/>}
        <div className="mt-10"><Heading eyebrow="Your history" title="Dishes you tried" /></div>
        {tried.size ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{demoDishes.filter((item) => tried.has(item.id)).map((item) =>
          <button type="button" onClick={() => go("dish", item.id)} className={border + " flex items-center gap-3 p-3 text-left hover:border-[#e75a45]"} key={item.id}>
            <div className="h-20 w-20 shrink-0 overflow-hidden"><Photo dish={item} className="h-full w-full object-cover"/></div>
            <span className="font-semibold">{item.name}</span>
          </button>)}</div> : <p className="mt-4 text-sm text-white/50">No tried marks yet.</p>}
        <div className="mt-10"><Heading eyebrow="Your circle" title="Following" /></div>
        <div className="mt-5 flex flex-wrap gap-3">
          {demoPeople.filter((person) => following.has(person.username)).map((person) => <button type="button" key={person.username} onClick={() => go("profile", person.username)}
            className={border + " flex items-center gap-2 p-3 text-left hover:border-[#e75a45]"}><Avatar person={person}/><span className="text-sm">{person.name}</span></button>)}
        </div>
      </section> : null}
    </main>

    <footer className="border-t border-white/10 bg-[#181716] px-5 py-8 text-center text-xs leading-6 text-white/50">
      <p>JaanNee · Development demo only · No Supabase queries or writes from this experience</p>
      <p>Fictional restaurants and diners. Photos, rankings and menu prices are illustrative, not verified claims.</p>
    </footer>

    <nav aria-label="Demo mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-white/15 bg-[#191817]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = view === item.view || (item.view === "discover" && (view === "dish" || view === "place")) ||
          (item.view === "people" && view === "profile");
        return <button type="button" key={item.view} onClick={() => go(item.view)} aria-current={active ? "page" : undefined}
          className={"flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-bold " +
            (active ? "text-[#ff785f]" : "text-white/65")}><Icon size={20}/><span>{item.label}</span></button>;
      })}
    </nav>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="font-display text-3xl text-white">{value}</p><p className="mt-1 text-xs uppercase tracking-wider text-white/50">{label}</p></div>;
}

function Missing({ onBack }: { onBack: () => void }) {
  return <div className="px-5 py-20 text-center"><h1 className="font-display text-4xl">Not in this demo</h1>
    <p className="mt-3 text-sm text-white/55">That fictional entry wasn't found.</p>
    <button type="button" className={buttonStyle + " mt-6"} onClick={onBack}>Back to discovery</button></div>;
}

function EmptyState({ title, message, action, onClick }: { title: string; message: string; action: string; onClick: () => void }) {
  return <div className={border + " mt-7 p-8 text-center"}>
    <Sparkles size={26} className="mx-auto text-[#f47960]"/>
    <h3 className="mt-4 font-display text-3xl">{title}</h3>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/60">{message}</p>
    <button type="button" onClick={onClick} className={buttonStyle + " mt-5"}>{action} <ArrowRight size={15}/></button>
  </div>;
}

function PlacePage({ restaurant, navigate, saved, toggleSaved }: {
  restaurant: DemoRestaurant; navigate: DemoNavigation; saved: Set<string>; toggleSaved: (id: string) => void;
}) {
  const dishes = demoDishes.filter((item) => item.restaurantId === restaurant.id);
  const heroDish = dishes[0];
  return <section className="pb-14">
    <div className="relative min-h-[21rem] overflow-hidden bg-[#27201b] sm:min-h-[29rem]">
      {heroDish ? <Photo dish={heroDish} className="absolute inset-0 h-full w-full object-cover"/> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10"/>
      <button type="button" onClick={() => navigate("discover")} aria-label="Back to discovery" className="absolute left-4 top-5 grid h-11 w-11 place-items-center border border-white/35 bg-black/50"><ArrowLeft size={19}/></button>
      <div className="absolute bottom-0 p-6 sm:p-10"><Label>Fictional restaurant profile</Label>
        <h1 className="mt-3 max-w-4xl font-display text-[clamp(3.4rem,7vw,6.5rem)] leading-[0.9]">{restaurant.name}</h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-white/75"><MapPin size={15}/>{restaurant.area}, Bangkok · {restaurant.subtitle}</p>
      </div>
    </div>
    <div className="px-5 py-9 sm:px-9">
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div><Heading eyebrow="The concept" title="About this sample place" description={restaurant.intro}/></div>
        <div className={border + " p-5 text-xs leading-6 text-amber-200"}>
          This venue does not exist. No directions, reservation links, or contact details are provided in the demo.
        </div>
      </div>
      <div className="mt-11"><Heading eyebrow="The menu" title="Sample dishes here" description="Demo descriptions and pricing are invented for interface testing."/></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {dishes.map((item) => <SampleDishCard key={item.id} dish={item} navigate={navigate} saved={saved.has(item.id)} toggleSave={toggleSaved}/>)}
      </div>
    </div>
  </section>;
}

function ProfilePage({ person, navigate, following, toggleFollow, share }: {
  person: DemoPerson; navigate: DemoNavigation; following: boolean; toggleFollow: () => void; share: () => void;
}) {
  const picks = person.picks.map((pick) => ({ dish: demoDishes.find((item) => item.id === pick.dishId)!, note: pick.note }));
  return <section className="px-4 py-10 sm:px-8 md:py-14">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="flex items-center gap-4"><div className="scale-125"><Avatar person={person}/></div>
        <div className="ml-3"><Label>Fictional diner profile</Label><h1 className="mt-2 font-display text-5xl">{person.name}</h1>
          <p className="mt-1 text-sm text-white/50">@{person.username}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={toggleFollow} className={buttonStyle}>
          {following ? <Check size={16}/> : <Users size={16}/>}
          {following ? "Following in demo" : "Follow in demo"}
        </button>
        <button type="button" onClick={share} className={buttonStyle}><Share2 size={16}/>Share sample profile</button>
      </div>
    </div>
    <p className="mt-5 max-w-xl text-sm leading-7 text-white/65">{person.bio}</p>
    <div className="mt-9 border-t border-white/10 pt-8">
      <Heading eyebrow="Intentional recommendations" title="Food I would share"
        description="These picks are fictional and do not represent a real diner or an independently verified restaurant."/>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map(({ dish, note }) => <button key={dish.id} type="button" onClick={() => navigate("dish", dish.id)}
          className={border + " overflow-hidden text-left hover:border-[#e65c47]"}>
          <div className="aspect-[16/10] overflow-hidden"><Photo dish={dish} className="h-full w-full object-cover"/></div>
          <div className="p-5"><Label>{dish.category}</Label><h3 className="mt-2 font-display text-3xl">{dish.name}</h3>
            <p className="mt-3 border-l-2 border-[#f26d57] pl-3 text-sm leading-6 text-white/70">“{note}”</p></div>
        </button>)}
      </div>
    </div>
    <div className="mt-10"><Heading eyebrow="Find more diners" title="Follow a new taste"/>
      <button type="button" onClick={() => navigate("people")} className={buttonStyle + " mt-5"}>Meet sample diners <ArrowRight size={15}/></button></div>
  </section>;
}
