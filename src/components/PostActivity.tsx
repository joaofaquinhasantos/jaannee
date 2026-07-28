import { Link } from "@tanstack/react-router";
import { Bell, Check, Circle, Trophy } from "lucide-react";
import { localizedName } from "@/lib/names";
import {
  buildPostInbox,
  comparisonsUntilRank,
  postMilestones,
  type PostInboxItem,
  type PostLifecycleDish,
  type PostMilestoneKey,
} from "@/lib/post-lifecycle";
import { useI18n } from "@/lib/i18n";

export function PostActivity({ dishes }: { dishes: PostLifecycleDish[] }) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  if (dishes.length === 0) return null;

  const inbox = buildPostInbox(dishes);

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-4 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {copy("Your activity", "กิจกรรมของคุณ")}
          </p>
          <h2 className="type-section-title mt-1">
            {copy("What changed since you posted", "ความคืบหน้าหลังจากที่คุณโพสต์")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {copy(
              "Follow each dish from its first post to a public rank.",
              "ติดตามแต่ละจานตั้งแต่โพสต์ครั้งแรกจนได้รับอันดับสาธารณะ",
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {inbox.map((item) => (
          <InboxCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function InboxCard({ item }: { item: PostInboxItem }) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const dish = item.dish;
  const name = localizedName(dish, lang);
  const remaining = comparisonsUntilRank(dish);
  const message =
    item.kind === "ranked"
      ? copy("This dish now has a public rank.", "จานนี้ได้รับอันดับสาธารณะแล้ว")
      : item.kind === "almost-ranked"
        ? copy(
            `${remaining} more ${remaining === 1 ? "comparison" : "comparisons"} to unlock its public rank.`,
            `อีก ${remaining} การเปรียบเทียบเพื่อปลดล็อกอันดับสาธารณะ`,
          )
        : item.kind === "first-comparison"
          ? copy("This dish received its first comparison.", "จานนี้ได้รับการเปรียบเทียบครั้งแรกแล้ว")
          : item.kind === "first-try"
            ? copy("A diner marked this dish as tried.", "มีนักชิมทำเครื่องหมายว่าเคยกินจานนี้แล้ว")
            : item.kind === "reviewed"
              ? dish.status === "rejected"
                ? copy("This post needs attention after review.", "โพสต์นี้ต้องตรวจสอบหลังการรีวิว")
                : copy("Admin review is complete.", "การตรวจสอบโดยแอดมินเสร็จแล้ว")
              : copy("Your post is live and awaiting review.", "โพสต์ของคุณเผยแพร่แล้วและกำลังรอตรวจสอบ");

  return (
    <Link
      to="/dish/$id"
      params={{ id: dish.id }}
      className="group grid grid-cols-[4.5rem_1fr] gap-3 rounded-md border border-border p-3 transition-colors hover:border-primary/50"
    >
      <div className="aspect-square overflow-hidden rounded-md bg-muted">
        {dish.photo_url ? (
          <img src={dish.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {item.kind === "ranked" ? (
            <Trophy className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          ) : null}
          <p className="truncate font-semibold">{name}</p>
        </div>
        {dish.place?.name ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{dish.place.name}</p>
        ) : null}
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{message}</p>
      </div>
    </Link>
  );
}

export function PostProgressTimeline({ dish }: { dish: PostLifecycleDish }) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const labels: Record<PostMilestoneKey, string> = {
    live: copy("Live", "เผยแพร่แล้ว"),
    reviewed: copy("Reviewed", "ตรวจสอบแล้ว"),
    tried: copy("Tried by a diner", "มีนักชิมเคยกิน"),
    compared: copy("First comparison", "เปรียบเทียบครั้งแรก"),
    ranked: copy("Publicly ranked", "ได้รับอันดับสาธารณะ"),
  };

  return (
    <ol
      className="mt-4 grid grid-cols-5 gap-1"
      aria-label={copy("Post progress", "ความคืบหน้าของโพสต์")}
    >
      {postMilestones(dish).map((stage, index) => (
        <li key={stage.key} className="min-w-0">
          <div className="flex items-center">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                stage.complete
                  ? "border-primary bg-primary text-primary-foreground"
                  : stage.current
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
              }`}
            >
              {stage.complete ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Circle className="h-2.5 w-2.5" aria-hidden="true" />
              )}
            </span>
            {index < 4 ? (
              <span
                className={`h-px min-w-0 flex-1 ${
                  stage.complete ? "bg-primary" : "bg-border"
                }`}
              />
            ) : null}
          </div>
          <p
            className={`mt-2 pr-1 text-[10px] font-bold leading-tight ${
              stage.current ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {labels[stage.key]}
          </p>
        </li>
      ))}
    </ol>
  );
}
