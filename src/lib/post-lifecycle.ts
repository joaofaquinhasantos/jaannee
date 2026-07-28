import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

export type PostLifecycleDish = {
  id: string;
  name_en?: string | null;
  name_th?: string | null;
  photo_url?: string | null;
  status?: string | null;
  comparisons_count?: number | null;
  tried_count?: number | null;
  created_at?: string | null;
  place?: { name?: string | null } | null;
};

export type PostMilestoneKey = "live" | "reviewed" | "tried" | "compared" | "ranked";

export type PostMilestone = {
  key: PostMilestoneKey;
  complete: boolean;
  current: boolean;
};

export type PostInboxItem = {
  id: string;
  dish: PostLifecycleDish;
  kind: "ranked" | "almost-ranked" | "first-comparison" | "first-try" | "reviewed" | "live";
  priority: number;
};

export function postMilestones(dish: PostLifecycleDish): PostMilestone[] {
  const reviewed = dish.status === "approved" || dish.status === "rejected";
  const tried = (dish.tried_count ?? 0) > 0;
  const compared = (dish.comparisons_count ?? 0) > 0;
  const ranked = (dish.comparisons_count ?? 0) >= PUBLIC_RANK_THRESHOLD;
  const completion = [true, reviewed, tried, compared, ranked];
  const firstIncomplete = completion.findIndex((value) => !value);

  return (["live", "reviewed", "tried", "compared", "ranked"] as const).map(
    (key, index) => ({
      key,
      complete: completion[index],
      current:
        dish.status === "rejected"
          ? key === "reviewed"
          : firstIncomplete === -1
            ? key === "ranked"
            : index === firstIncomplete,
    }),
  );
}

export function comparisonsUntilRank(dish: PostLifecycleDish) {
  return Math.max(0, PUBLIC_RANK_THRESHOLD - (dish.comparisons_count ?? 0));
}

export function postInboxItem(dish: PostLifecycleDish): PostInboxItem {
  const comparisons = dish.comparisons_count ?? 0;
  const tried = dish.tried_count ?? 0;
  let kind: PostInboxItem["kind"] = "live";
  let priority = 10;

  if (comparisons >= PUBLIC_RANK_THRESHOLD) {
    kind = "ranked";
    priority = 60;
  } else if (comparisons >= PUBLIC_RANK_THRESHOLD - 2) {
    kind = "almost-ranked";
    priority = 50 + comparisons;
  } else if (comparisons > 0) {
    kind = "first-comparison";
    priority = 40;
  } else if (tried > 0) {
    kind = "first-try";
    priority = 30;
  } else if (dish.status === "approved" || dish.status === "rejected") {
    kind = "reviewed";
    priority = 20;
  }

  return { id: `${dish.id}:${kind}`, dish, kind, priority };
}

export function buildPostInbox(dishes: PostLifecycleDish[], limit = 6) {
  return dishes
    .map(postInboxItem)
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const aTime = Date.parse(a.dish.created_at ?? "") || 0;
      const bTime = Date.parse(b.dish.created_at ?? "") || 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.dish.id.localeCompare(b.dish.id);
    })
    .slice(0, limit);
}
