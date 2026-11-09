import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HeartHandshake } from "lucide-react";
import { listFollowingPicks } from "@/lib/recommendations.functions";
import { useI18n } from "@/lib/i18n";

export function FollowingDishPicks({ dishId, enabled }: { dishId: string; enabled: boolean }) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => lang === "th" ? th : en;
  const query = useQuery({
    queryKey: ["following-picks", dishId],
    queryFn: () => listFollowingPicks({ data: { dishId } }),
    enabled,
    staleTime: 60_000,
  });
  if (!enabled || !query.data?.length) return null;
  return (
    <section className="mt-8 border border-primary/25 bg-primary/[0.055] p-5 sm:p-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
        <HeartHandshake size={17} aria-hidden="true" />
        {copy("Recommended by people you follow", "แนะนำโดยคนที่คุณติดตาม")}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {copy(
          "These diners explicitly recommend this dish. Their picks are separate from JaanNee's independent comparison rankings.",
          "นักชิมเหล่านี้ตั้งใจแนะนำจานนี้ โดยไม่ส่งผลต่ออันดับจากการเปรียบเทียบ",
        )}
      </p>
      <div className="mt-4 space-y-3">
        {query.data.slice(0, 5).map((pick) => (
          <div key={pick.user_id} className="border-t border-primary/15 pt-3 first:border-none first:pt-0">
            <Link
              to="/u/$username"
              params={{ username: pick.profile.username }}
              className="text-sm font-semibold underline decoration-primary/40 underline-offset-2 hover:text-primary"
            >
              {pick.profile.display_name || `@${pick.profile.username}`}
            </Link>
            {pick.note ? <p className="mt-1 text-sm leading-6">{pick.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
