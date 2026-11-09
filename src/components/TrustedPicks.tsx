import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HeartHandshake, Users } from "lucide-react";
import { groupFollowingPicks } from "@/lib/pick-display";
import { listFollowingPicks } from "@/lib/recommendations.functions";
import { useAuthUser } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";

export function TrustedPicks() {
  const { status, userId } = useAuthUser();
  const { lang } = useI18n();
  const copy = (en: string, th: string) => lang === "th" ? th : en;
  const query = useQuery({
    queryKey: ["following-picks", userId],
    queryFn: () => listFollowingPicks({ data: {} }),
    enabled: status === "in",
    staleTime: 60_000,
  });
  if (status === "loading") return null;

  const picks = groupFollowingPicks(query.data ?? []);
  return (
    <section
      aria-label={copy("Recommendations from people you follow", "คำแนะนำจากคนที่คุณติดตาม")}
      className="border-b border-white/10 bg-[#1a1918] px-4 py-8 text-white md:px-8 md:py-10"
    >
      <div className="mx-auto max-w-[112rem]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary">
              <Users size={15} aria-hidden="true" />
              {copy("People you follow", "คนที่คุณติดตาม")}
            </p>
            <h2 className="mt-2 font-noir-display text-3xl uppercase leading-tight md:text-5xl">
              {copy("Their picks. Your next plate.", "จานโปรดของคนที่คุณติดตาม")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              {copy(
                "Only dishes someone chose to recommend—not dishes they merely tried. Community rankings stay independent.",
                "เฉพาะจานที่ผู้ใช้ตั้งใจแนะนำ ไม่ใช่แค่จานที่เคยกิน และไม่ส่งผลต่ออันดับส่วนรวม",
              )}
            </p>
          </div>
          {status === "in" ? (
            <Link to="/profile" className="inline-flex min-h-11 items-center border border-white/25 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:border-primary">
              {copy("Share your own picks", "แชร์จานที่คุณแนะนำ")}
            </Link>
          ) : (
            <Link to="/auth" className="inline-flex min-h-11 items-center bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground">
              {copy("Sign in to follow diners", "เข้าสู่ระบบเพื่อติดตามนักชิม")}
            </Link>
          )}
        </div>
        {status === "out" ? (
          <p className="mt-5 border-l-2 border-primary bg-white/[0.035] px-4 py-4 text-sm text-white/75">
            {copy(
              "Follow diners whose taste you trust. Their recommendations will appear here when they publish a pick.",
              "ติดตามนักชิมที่คุณเชื่อใจ แล้วดูจานที่พวกเขาเลือกแนะนำได้ที่นี่",
            )}
          </p>
        ) : query.isLoading ? (
          <p className="mt-5 text-sm text-white/65">{copy("Loading picks…", "กำลังโหลดจานแนะนำ…")}</p>
        ) : query.isError ? (
          <p className="mt-5 text-sm text-white/65">
            {copy("Recommendations are temporarily unavailable.", "ยังไม่สามารถโหลดคำแนะนำได้ในขณะนี้")}
          </p>
        ) : picks.length === 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-white/[0.035] p-5">
            <p className="max-w-xl text-sm leading-6 text-white/75">
              {copy(
                "No picks from your circle yet. Visit a diner's public profile to follow them, or recommend a dish you have tried.",
                "ยังไม่มีจานแนะนำจากคนที่คุณติดตาม ลองติดตามนักชิมผ่านโปรไฟล์ หรือแนะนำจานที่คุณเคยกิน",
              )}
            </p>
            <Link to="/rankings" className="inline-flex min-h-10 items-center text-xs font-bold uppercase tracking-wide text-primary">
              {copy("Explore dishes", "สำรวจเมนู")}
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {picks.map((group) => {
              const dish = group.dish;
              const names = group.supporters.slice(0, 3);
              const featuredNote = group.supporters.find((pick) => pick.note.trim());
              return (
                <article key={dish.id} className="flex min-w-0 gap-4 border border-white/10 bg-black/20 p-4">
                  <Link to="/dish/$id" params={{ id: dish.id }} className="h-28 w-24 shrink-0 overflow-hidden bg-white/10 sm:h-32 sm:w-28">
                    {dish.photo_url ? (
                      <img className="h-full w-full object-cover" src={dish.photo_url} alt="" loading="lazy" />
                    ) : (
                      <span className="flex h-full items-center justify-center p-2 text-center text-xs text-white/65">
                        {localizedName(dish, lang)}
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to="/dish/$id" params={{ id: dish.id }} className="font-semibold leading-tight text-white hover:text-primary">
                      {localizedName(dish, lang)}
                    </Link>
                    <p className="mt-1 truncate text-xs text-white/65">{dish.place?.name}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <HeartHandshake size={15} aria-hidden="true" />
                      {group.supporters.length} {copy(group.supporters.length === 1 ? "explicit pick" : "explicit picks", "คนแนะนำ")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/75">
                      {names.map((pick, index) => (
                        <span key={pick.user_id}>
                          {index > 0 ? ", " : ""}
                          <Link to="/u/$username" params={{ username: pick.profile.username }} className="underline decoration-white/25 underline-offset-2 hover:text-primary">
                            {pick.profile.display_name || `@${pick.profile.username}`}
                          </Link>
                        </span>
                      ))}
                      {group.supporters.length > names.length ? ` +${group.supporters.length - names.length}` : ""}
                    </p>
                    {featuredNote ? (
                      <p className="mt-2 line-clamp-2 border-l border-primary/70 pl-2 text-xs italic text-white/65">
                        “{featuredNote.note}”
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
