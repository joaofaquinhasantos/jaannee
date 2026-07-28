import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Clock3, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ComparePromptDrawer,
  PairProgress,
  useComparePairs,
  type TriedDish,
} from "@/components/ContextualCompare";
import { listFollowingActivityFeed, myProfile } from "@/lib/dishes.functions";
import { useAuthUser } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";

type ActivityItem = {
  type: "posted" | "tried";
  created_at: string;
  dish: {
    id: string;
    name_en?: string | null;
    name_th?: string | null;
    photo_url?: string | null;
    place?: { name?: string | null } | null;
  };
  profile?: {
    display_name?: string | null;
    username?: string | null;
  } | null;
};

export function ReturnHub() {
  const { userId, status } = useAuthUser();
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const { nextPair, isLoading: pairLoading } = useComparePairs();
  const [compareOpen, setCompareOpen] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => myProfile(),
    enabled: status === "in",
    staleTime: 60_000,
  });
  const activity = useQuery({
    queryKey: ["following-activity", userId],
    queryFn: () => listFollowingActivityFeed(),
    enabled: status === "in",
    staleTime: 60_000,
  });

  if (status !== "in") return null;

  const savedCount = profile.data?.want_to_try?.length ?? 0;
  const pendingCount =
    profile.data?.posted?.filter((dish: { status?: string | null }) => dish.status === "pending")
      .length ?? 0;
  const activityItems = (activity.data ?? []).slice(0, 3) as ActivityItem[];
  const hasReturnReason = Boolean(nextPair || savedCount || pendingCount || activityItems.length);

  if (profile.isLoading || pairLoading || activity.isLoading) return null;
  if (!hasReturnReason) return null;

  return (
    <section className="border-b border-white/10 bg-[#171717] px-4 py-6 text-white md:px-8 md:py-8">
      <div className="mx-auto max-w-[112rem]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              {copy("Your JaanNee", "JaanNee ของคุณ")}
            </p>
            <h2 className="mt-2 font-noir-display text-4xl uppercase leading-none md:text-5xl">
              {copy("Pick up where you left off", "กลับมาต่อจากครั้งก่อน")}
            </h2>
          </div>
          <Link to="/profile" className="hidden text-xs font-bold text-white/55 hover:text-white sm:block">
            {copy("View my profile", "ดูโปรไฟล์ของฉัน")}
          </Link>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {nextPair ? (
            <article className="border border-primary/60 bg-primary/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                {copy("Ready to compare", "พร้อมเปรียบเทียบ")}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <PairThumb dish={nextPair.a as TriedDish} />
                <span className="text-xs font-bold text-white/40">VS</span>
                <PairThumb dish={nextPair.b as TriedDish} />
              </div>
              <PairProgress pair={nextPair} />
              <Button className="mt-4 w-full" onClick={() => setCompareOpen(true)}>
                {copy("Choose your preferred dish", "เลือกจานที่คุณชอบ")}
              </Button>
            </article>
          ) : null}

          {savedCount > 0 || pendingCount > 0 ? (
            <article className="border border-white/15 bg-black/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                {copy("Your next moves", "สิ่งที่รอคุณอยู่")}
              </p>
              <div className="mt-4 space-y-3">
                {savedCount > 0 ? (
                  <ReturnStat
                    icon={<Bookmark className="h-4 w-4" aria-hidden="true" />}
                    value={savedCount}
                    label={copy(
                      savedCount === 1 ? "dish saved for your next meal" : "dishes saved for your next meal",
                      "จานที่บันทึกไว้สำหรับมื้อต่อไป",
                    )}
                  />
                ) : null}
                {pendingCount > 0 ? (
                  <ReturnStat
                    icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
                    value={pendingCount}
                    label={copy(
                      pendingCount === 1 ? "live post awaiting review" : "live posts awaiting review",
                      "โพสต์ที่เผยแพร่แล้วและรอตรวจสอบ",
                    )}
                  />
                ) : null}
              </div>
              <Link to="/profile" className="mt-4 inline-block text-xs font-bold text-primary">
                {copy("Open my JaanNee", "เปิด JaanNee ของฉัน")}
              </Link>
            </article>
          ) : null}

          {activityItems.length > 0 ? (
            <article className="border border-white/15 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                  {copy("From people you follow", "จากคนที่คุณติดตาม")}
                </p>
              </div>
              <div className="mt-3 divide-y divide-white/10">
                {activityItems.map((item) => (
                  <ActivityRow key={`${item.type}-${item.dish.id}-${item.created_at}`} item={item} />
                ))}
              </div>
            </article>
          ) : null}
        </div>
      </div>

      <ComparePromptDrawer
        open={compareOpen}
        onOpenChange={setCompareOpen}
        a={(nextPair?.a as TriedDish | undefined) ?? null}
        b={(nextPair?.b as TriedDish | undefined) ?? null}
      />
    </section>
  );
}

function PairThumb({ dish }: { dish: TriedDish }) {
  const { lang } = useI18n();
  return (
    <div className="min-w-0 flex-1">
      <div className="aspect-[4/3] overflow-hidden bg-black">
        {dish.photo_url ? (
          <img src={dish.photo_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold">{localizedName(dish, lang)}</p>
    </div>
  );
}

function ReturnStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex h-8 w-8 items-center justify-center border border-white/15 text-primary">
        {icon}
      </span>
      <p>
        <strong className="mr-1 text-white">{value}</strong>
        <span className="text-white/55">{label}</span>
      </p>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const diner =
    item.profile?.display_name ||
    (item.profile?.username ? `@${item.profile.username}` : copy("A diner", "นักชิม"));
  return (
    <Link
      to="/dish/$id"
      params={{ id: item.dish.id }}
      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden bg-black">
        {item.dish.photo_url ? (
          <img src={item.dish.photo_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-white/55">
          {diner}{" "}
          {item.type === "posted"
            ? copy("posted", "โพสต์")
            : copy("marked as tried", "ทำเครื่องหมายว่าเคยกิน")}
        </p>
        <p className="mt-1 truncate text-sm font-semibold">
          {localizedName(item.dish, lang)}
        </p>
      </div>
    </Link>
  );
}
