import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Instagram, Menu, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { DishCard } from "@/components/DishCard";
import { getPublicRestaurantProfile } from "@/lib/restaurant.functions";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";

export const Route = createFileRoute("/place/$placeId")({
  loader: ({ params }) => getPublicRestaurantProfile({ data: { placeId: params.placeId } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.place?.name} — JaanNee` : "Restaurant — JaanNee" },
      {
        name: "description",
        content: loaderData
          ? `Official information and diner-added dishes at ${loaderData.place?.name}. Rankings remain diner-controlled.`
          : "Verified restaurant profile on JaanNee.",
      },
    ],
  }),
  component: PublicRestaurantProfile,
});

function PublicRestaurantProfile() {
  const data = Route.useLoaderData();
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  if (!data) {
    return (
      <AppShell>
        <section className="mx-auto max-w-xl py-16 text-center">
          <h1 className="type-page-title">{copy("Restaurant profile not available", "ยังไม่มีโปรไฟล์ร้าน")}</h1>
          <Link to="/"><Button className="mt-5">{copy("Discover dishes", "ค้นพบจาน")}</Button></Link>
        </section>
      </AppShell>
    );
  }
  const place = data.place;
  const area = localizedName(place?.area, lang);
  const dishes = data.dishes ?? [];
  return (
    <AppShell>
      <section className="border-b border-border pb-7">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
          <ShieldCheck size={17} /> {copy("Verified official profile", "โปรไฟล์ทางการที่ยืนยันแล้ว")}
        </p>
        <h1 className="type-page-title mt-3">{place?.name}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{[place?.address, area].filter(Boolean).join(" · ")}</p>
        {data.official_description ? <p className="mt-5 max-w-3xl text-base leading-7">{data.official_description}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {data.menu_url ? <ExternalButton href={data.menu_url} icon={<Menu size={16} />} label={copy("Official menu", "เมนูทางการ")} /> : null}
          {data.line_url ? <ExternalButton href={data.line_url} icon={<MessageCircle size={16} />} label="LINE" /> : null}
          {data.instagram_url ? <ExternalButton href={data.instagram_url} icon={<Instagram size={16} />} label="Instagram" /> : null}
          {data.phone ? <ExternalButton href={`tel:${data.phone}`} icon={<Phone size={16} />} label={data.phone} /> : null}
          {place?.google_maps_url ? <ExternalButton href={place.google_maps_url} icon={<ExternalLink size={16} />} label={copy("Directions", "เส้นทาง")} /> : null}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-secondary/30 p-4">
        <p className="text-sm leading-6 text-muted-foreground">
          {copy(
            "Official restaurant information is supplied by the verified business. Every dish, tried mark, comparison, and ranking remains controlled exclusively by diners.",
            "ข้อมูลทางการมาจากร้านที่ยืนยันแล้ว ส่วนจาน สถานะเคยกิน การเปรียบเทียบ และอันดับทั้งหมดควบคุมโดยนักชิมเท่านั้น",
          )}
        </p>
      </section>

      <section className="mt-9">
        <p className="editorial-kicker text-primary">{copy("Diner-added dishes", "จานที่นักชิมเพิ่ม")}</p>
        <h2 className="type-section-title mt-2">{copy("Dishes connected to this place", "จานที่เชื่อมกับร้านนี้")}</h2>
        {dishes.length ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dishes.map((dish: any) => <DishCard key={dish.id} dish={dish} />)}
          </div>
        ) : <p className="mt-4 text-sm text-muted-foreground">{copy("No diner-added dishes yet.", "ยังไม่มีจานที่นักชิมเพิ่ม")}</p>}
      </section>
    </AppShell>
  );
}

function ExternalButton({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a href={href} target={href.startsWith("tel:") ? undefined : "_blank"} rel="noreferrer">
      <Button variant="outline" className="min-h-11 gap-2">{icon}{label}</Button>
    </a>
  );
}
