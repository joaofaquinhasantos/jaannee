import { Gift, ShieldCheck } from "lucide-react";

export function VoucherCard({
  restaurantName,
  title,
  message,
  securityNumber,
  terms,
  expiresAt,
  language = "en",
}: {
  restaurantName: string;
  title: string;
  message: string;
  securityNumber: string;
  terms?: string | null;
  expiresAt?: string | null;
  language?: "en" | "th";
}) {
  const copy = (en: string, th: string) => (language === "th" ? th : en);
  return (
    <article className="relative isolate mt-3 overflow-hidden rounded-xl border border-gold/60 bg-[linear-gradient(135deg,#2A1E24_0%,#151113_58%,#3A211E_100%)] p-5 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border-[28px] border-primary/20" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
            <Gift size={14} /> {copy("JaanNee gift voucher", "บัตรกำนัล JaanNee")}
          </p>
          <p className="mt-2 text-sm font-semibold text-white/70">{restaurantName}</p>
        </div>
        <ShieldCheck className="shrink-0 text-gold" size={25} />
      </div>
      <div className="relative mt-7">
        <h3 className="font-display text-3xl uppercase leading-none md:text-4xl">{title}</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">{message}</p>
      </div>
      <div className="relative mt-7 grid gap-3 border-t border-dashed border-white/30 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
            {copy("Security number", "หมายเลขความปลอดภัย")}
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-wider text-gold">{securityNumber}</p>
        </div>
        {expiresAt ? (
          <div className="sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
              {copy("Valid until", "ใช้ได้ถึง")}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {new Date(expiresAt).toLocaleDateString(language === "th" ? "th-TH" : "en-GB")}
            </p>
          </div>
        ) : null}
      </div>
      {terms ? <p className="relative mt-4 text-[11px] leading-5 text-white/75">{terms}</p> : null}
      <p className="relative mt-4 text-[10px] font-semibold uppercase tracking-wider text-white/75">
        {copy("Present this message to the restaurant · Single use", "แสดงข้อความนี้ที่ร้าน · ใช้ได้ครั้งเดียว")}
      </p>
    </article>
  );
}

