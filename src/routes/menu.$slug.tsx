import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Globe, MapPin, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getPublicBusinessMenu } from "@/lib/business-live.functions";

type Language = "en" | "th" | "zh" | "fr" | "ja";
const languages: Record<Language,string> = {
  en: "English", th: "ไทย", zh: "中文", fr: "Français", ja: "日本語",
};

export const Route = createFileRoute("/menu/$slug")({
  loader: ({ params }) => getPublicBusinessMenu({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? loaderData.name + " · Menu · JaanNee" : "Menu unavailable · JaanNee" },
      { name: "description", content: loaderData ? "Browse the official menu of " + loaderData.name : "This menu has not been published." },
      { name: "robots", content: loaderData ? "index,follow" : "noindex,nofollow" },
    ],
  }),
  component: PublishedBusinessMenu,
});

function PublishedBusinessMenu() {
  const menu = Route.useLoaderData();
  const [language, setLanguage] = useState<Language>("en");

  if (!menu) {
    return <AppShell tone="noir">
      <main className="mx-auto max-w-lg py-20 text-center">
        <ShieldCheck className="mx-auto text-primary" size={36}/>
        <h1 className="mt-4 font-display text-4xl">Menu not available</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This restaurant menu is unpublished, under review, or no longer available.
        </p>
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center gap-2 underline underline-offset-4">
          <ArrowLeft size={17}/> Explore JaanNee
        </Link>
      </main>
    </AppShell>;
  }

  const sections: string[] = Array.from(new Set<string>(menu.dishes.map((dish: any) => String(dish.category || "Menu"))));
  const langName = (item: any) => {
    if (language === "en") return item.name_en;
    if (language === "th") return item.name_th || item.name_en;
    return item.approved_translations?.[language]?.name || item.name_en;
  };
  const langDescription = (item: any) => {
    if (language === "en") return item.description_en;
    if (language === "th") return item.description_th || item.description_en;
    return item.approved_translations?.[language]?.description || item.description_en;
  };
  const isFallback = (item: any) => language !== "en" && (
    language === "th" ? !item.name_th : !item.approved_translations?.[language]?.name
  );

  return <div className="min-h-screen bg-[#f5f0e8] text-[#282622]">
    <header className="bg-[#242722] px-5 py-12 text-white sm:px-9">
      <div className="mx-auto max-w-3xl">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#e8bd9f]">
          <ShieldCheck size={15}/> Verified restaurant · Published menu
        </p>
        <h1 className="mt-4 font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9]">{menu.name}</h1>
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/70">
          <MapPin size={16}/>{menu.area} · {menu.cuisine}
        </p>
        {menu.description ? <p className="mt-4 max-w-xl text-sm leading-7 text-white/75">{menu.description}</p> : null}
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-5 pb-14 sm:px-9">
      <section className="sticky top-0 z-10 -mx-5 border-b border-[#dbd1c3] bg-[#f5f0e8]/95 px-5 py-4 backdrop-blur sm:-mx-9 sm:px-9">
        <p className="flex items-center gap-2 text-xs font-semibold text-[#655c50]">
          <Globe size={16}/> Menu language
        </p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Menu languages">
          {(Object.keys(languages) as Language[]).map((lang) =>
            <button type="button" key={lang} onClick={() => setLanguage(lang)} aria-pressed={lang === language}
              className={"min-h-10 border px-3 text-xs font-bold " +
                (language === lang ? "border-[#a63f2e] bg-[#a63f2e] text-white" : "border-[#cabdaf] text-[#5b5149] hover:border-[#b74835]")}>
              {languages[lang]}
            </button>)}
        </div>
        <p className="mt-2 text-[11px] text-[#786b5c]">
          Missing restaurant-approved translations display in English.
        </p>
      </section>

      {sections.length ? sections.map((section) => <section key={section} className="pt-9">
        <h2 className="border-b border-[#cbbdab] pb-3 font-display text-3xl">{section}</h2>
        <div className="divide-y divide-[#ddd1c3]">
          {menu.dishes.filter((dish: any) => (dish.category || "Menu") === section)
            .map((item: any) => <article key={item.id} className="flex gap-4 py-5">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-6">{langName(item)}</h3>
                {langDescription(item) ? <p className="mt-2 text-sm leading-6 text-[#71675b]">{langDescription(item)}</p> : null}
                {isFallback(item) ? <p className="mt-1 text-[11px] text-[#a34330]">English fallback</p> : null}
              </div>
              <p className="shrink-0 font-semibold">฿{Number(item.price_thb).toLocaleString("en-TH")}</p>
            </article>)}
        </div>
      </section>) :
        <div className="py-12 text-center text-sm text-[#776d61]">
          <UtensilsCrossed className="mx-auto mb-3" size={27}/> No available dishes at the moment.
        </div>}
    </main>
    <footer className="border-t border-[#ddd0c1] px-5 py-6 text-center text-xs leading-6 text-[#766b5d]">
      Official menu managed by the restaurant · Powered by JaanNee
      <br/>Prices and availability are determined by the restaurant.
    </footer>
  </div>;
}
