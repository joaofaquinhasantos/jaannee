import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  ImagePlus,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getPublicRestaurantProfile } from "@/lib/restaurant.functions";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

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
  return <RestaurantProfileView data={data} />;
}

export function RestaurantProfileView({ data }: { data: any }) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);

  if (!data) {
    return (
      <AppShell tone="noir">
        <section className="mx-auto max-w-xl py-20 text-center">
          <h1 className="type-page-title">
            {copy("Restaurant profile not available", "ยังไม่มีโปรไฟล์ร้าน")}
          </h1>
          <Link to="/">
            <Button className="mt-5">{copy("Discover dishes", "ค้นพบเมนู")}</Button>
          </Link>
        </section>
      </AppShell>
    );
  }

  const place = data.place;
  const area = localizedName(place?.area, lang);
  const dishes = data.dishes ?? [];
  const gallery = data.gallery ?? [];
  const updates = data.updates ?? [];
  const heroUrl = data.cover_url || gallery[0]?.photo_url || dishes[0]?.photo_url;
  const locationLine = [place?.address, area].filter(Boolean).join(" · ");
  const primaryActions = [
    data.menu_url
      ? {
          href: data.menu_url,
          icon: <Menu size={20} />,
          label: copy("Menu", "เมนู"),
        }
      : null,
    place?.google_maps_url
      ? {
          href: place.google_maps_url,
          icon: <MapPin size={20} />,
          label: copy("Directions", "เส้นทาง"),
        }
      : null,
    data.reservation_url
      ? {
          href: data.reservation_url,
          icon: <CalendarDays size={20} />,
          label: copy("Book now", "จองโต๊ะ"),
          primary: true,
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    icon: React.ReactNode;
    label: string;
    primary?: boolean;
  }>;

  return (
    <AppShell tone="noir" fullBleed>
      <main className="stitch-restaurant-profile pb-16">
        <section className="relative min-h-[420px] overflow-hidden sm:min-h-[520px] lg:min-h-[min(68svh,720px)]">
          {heroUrl ? (
            <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(214,50,31,0.24),transparent_38%),linear-gradient(145deg,#25201f,#0e0e0e)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/30 to-black/25" />
          <Link
            to="/"
            aria-label={copy("Back to Discover", "กลับไปหน้าค้นพบ")}
            className="absolute left-4 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/70 sm:left-7 sm:top-7"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="stitch-container absolute inset-x-0 bottom-0 pb-12 pt-28">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.14em] text-primary-foreground shadow-lg">
              <ShieldCheck size={15} />
              {copy("Verified venue", "ร้านที่ยืนยันแล้ว")}
            </p>
            <div className="mt-4 flex items-end gap-4">
              {data.logo_url ? (
                <img
                  src={data.logo_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-full border-2 border-white/60 object-cover shadow-xl sm:h-20 sm:w-20"
                />
              ) : null}
              <h1 className="max-w-5xl font-display text-[clamp(3.5rem,10vw,8rem)] uppercase leading-[0.82] tracking-[-0.045em] text-white">
                {place?.name}
              </h1>
            </div>
            {data.official_description ? (
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/78 sm:text-base">
                {data.official_description}
              </p>
            ) : null}
            {locationLine ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-white/65">
                <MapPin size={16} className="mt-0.5 shrink-0" />
                {locationLine}
              </p>
            ) : null}
          </div>
        </section>

        {primaryActions.length ? (
          <section className="stitch-container relative z-10 -mt-6">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${primaryActions.length}, minmax(0, 1fr))` }}
            >
              {primaryActions.map((action) => (
                <VenueAction key={action.label} {...action} />
              ))}
            </div>
          </section>
        ) : null}

        {(data.line_url || data.instagram_url || data.phone) && (
          <section className="stitch-container mt-5 flex flex-wrap gap-2">
            {data.line_url ? (
              <ContactLink href={data.line_url} icon={<MessageCircle size={16} />} label="LINE" />
            ) : null}
            {data.instagram_url ? (
              <ContactLink href={data.instagram_url} icon={<Instagram size={16} />} label="Instagram" />
            ) : null}
            {data.phone ? (
              <ContactLink href={`tel:${data.phone}`} icon={<Phone size={16} />} label={data.phone} />
            ) : null}
          </section>
        )}

        {gallery.length ? (
          <section className="stitch-container stitch-section">
            <SectionHeading
              kicker={copy("The restaurant", "บรรยากาศร้าน")}
              title={copy("Official gallery", "แกลเลอรีทางการ")}
              aside={copy(`${gallery.length} photos`, `${gallery.length} รูป`)}
            />
            <div className="-mx-5 mt-5 flex snap-x gap-3 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
              {gallery.map((photo: any) => (
                <figure
                  key={photo.id}
                  className="w-[72vw] max-w-[290px] shrink-0 snap-start overflow-hidden bg-card lg:w-auto lg:max-w-none"
                >
                  <img
                    src={photo.photo_url}
                    alt={photo.caption || ""}
                    className="aspect-[4/5] w-full object-cover"
                  />
                  {photo.caption ? (
                    <figcaption className="line-clamp-2 px-1 pt-2 text-xs text-muted-foreground">
                      {photo.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {updates.length ? (
          <section className="stitch-container stitch-section">
            <SectionHeading
              kicker={copy("From the restaurant", "จากทางร้าน")}
              title={copy("Official updates", "อัปเดตทางการ")}
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {updates.map((item: any) => (
                <article
                  key={item.id}
                  className="grid overflow-hidden rounded-lg border border-white/10 bg-card sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
                >
                  {item.photo_url ? (
                    <img src={item.photo_url} alt="" className="aspect-[4/3] h-full w-full object-cover" />
                  ) : null}
                  <div className="p-5">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-primary">
                      {copy("Official update", "อัปเดตจากร้าน")}
                    </p>
                    <h3 className="mt-2 font-display text-2xl uppercase leading-none">{item.title}</h3>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">
                      {item.body}
                    </p>
                    {item.cta_url ? (
                      <a
                        href={item.cta_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"
                      >
                        {item.cta_label || copy("Learn more", "ดูเพิ่มเติม")}
                        <ExternalLink size={14} />
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="stitch-section border-y border-white/10 bg-[#0e0e0e]">
          <div className="stitch-container">
            <SectionHeading
              kicker={copy("Community feed", "จากชุมชนนักชิม")}
              title={copy("Diner-added dishes", "เมนูที่นักชิมเพิ่ม")}
              aside={dishes.length ? copy(`${dishes.length} dishes`, `${dishes.length} เมนู`) : undefined}
            />
            {dishes.length ? (
              <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
                {dishes.map((dish: any) => (
                  <VenueDishTile key={dish.id} dish={dish} lang={lang} copy={copy} />
                ))}
              </div>
            ) : (
              <div className="mt-5 border border-dashed border-white/15 px-5 py-10 text-center">
                <ImagePlus className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {copy("No diner-added dishes yet.", "ยังไม่มีเมนูที่นักชิมเพิ่ม")}
                </p>
              </div>
            )}
            <Link to="/submit" className="mt-5 flex">
              <Button variant="outline" className="min-h-12 w-full gap-2">
                <ImagePlus size={17} />
                {copy("Add a dish you tried here", "เพิ่มเมนูที่คุณเคยกินที่นี่")}
              </Button>
            </Link>
          </div>
        </section>

        {(locationLine || place?.google_maps_url) && (
          <section className="stitch-container stitch-section">
            <SectionHeading
              kicker={copy("The location", "ที่ตั้ง")}
              title={area || copy("Find the restaurant", "ค้นหาร้าน")}
            />
            <div className="mt-5 flex flex-col gap-4 rounded-lg border border-white/10 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="font-semibold">{place?.name}</p>
                  {locationLine ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{locationLine}</p>
                  ) : null}
                </div>
              </div>
              {place?.google_maps_url ? (
                <a href={place.google_maps_url} target="_blank" rel="noreferrer">
                  <Button className="min-h-11 w-full gap-2 sm:w-auto">
                    <MapPin size={16} />
                    {copy("Open in Google Maps", "เปิดใน Google Maps")}
                  </Button>
                </a>
              ) : null}
            </div>
          </section>
        )}

        <section className="stitch-container pb-6">
          <div className="flex gap-3 border-t border-white/10 pt-6 text-xs leading-5 text-muted-foreground">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
            <p>
              {copy(
                "The verified restaurant manages its official information, gallery, booking links, and updates. Diner-added dishes, comparisons, and rankings remain independent and cannot be controlled or purchased by restaurants.",
                "ร้านที่ยืนยันแล้วจัดการเฉพาะข้อมูลทางการ รูปภาพ ลิงก์จอง และอัปเดตของร้าน ส่วนเมนูที่นักชิมเพิ่ม การเปรียบเทียบ และอันดับยังคงเป็นอิสระ ร้านไม่สามารถควบคุมหรือซื้ออันดับได้",
              )}
            </p>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function VenueAction({
  href,
  icon,
  label,
  primary = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-center transition active:scale-[0.98] ${
        primary
          ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_32px_rgba(214,50,31,0.28)]"
          : "border-white/10 bg-[#2a2929] text-foreground hover:border-white/25"
      }`}
    >
      {icon}
      <span className="text-[0.68rem] font-black uppercase tracking-[0.1em]">{label}</span>
    </a>
  );
}

function ContactLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const external = !href.startsWith("tel:");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 text-xs font-bold text-muted-foreground transition hover:border-white/25 hover:text-foreground"
    >
      {icon}
      {label}
    </a>
  );
}

function SectionHeading({
  kicker,
  title,
  aside,
}: {
  kicker: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-primary">{kicker}</p>
        <h2 className="mt-2 font-display text-[clamp(2.1rem,5vw,3.6rem)] uppercase leading-[0.9]">
          {title}
        </h2>
      </div>
      {aside ? (
        <span className="shrink-0 border-b border-white/20 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

function VenueDishTile({
  dish,
  lang,
  copy,
}: {
  dish: any;
  lang: "en" | "th";
  copy: (en: string, th: string) => string;
}) {
  const comparisonCount = Number(dish.comparisons_count ?? 0);
  const ranked = comparisonCount >= PUBLIC_RANK_THRESHOLD;
  const name = localizedName(dish, lang) || dish.name_en;

  return (
    <Link to="/dish/$id" params={{ id: dish.id }} className="group block min-w-0">
      <div className="relative overflow-hidden bg-card">
        {dish.photo_url ? (
          <img
            src={dish.photo_url}
            alt={name}
            className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="grid aspect-[4/5] place-items-center bg-white/[0.04] text-muted-foreground">
            <ImagePlus size={28} />
          </div>
        )}
        <span className="absolute left-2 top-2 bg-black/75 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">
          {ranked
            ? copy("Publicly ranked", "ได้รับอันดับแล้ว")
            : copy(
                `New contender · ${comparisonCount}/${PUBLIC_RANK_THRESHOLD}`,
                `ผู้ท้าชิงใหม่ · ${comparisonCount}/${PUBLIC_RANK_THRESHOLD}`,
              )}
        </span>
      </div>
      <p className="mt-2 truncate font-display text-xl uppercase leading-none">{name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {copy(
          `${comparisonCount} diner ${comparisonCount === 1 ? "comparison" : "comparisons"}`,
          `เปรียบเทียบโดยนักชิม ${comparisonCount} ครั้ง`,
        )}
      </p>
    </Link>
  );
}
