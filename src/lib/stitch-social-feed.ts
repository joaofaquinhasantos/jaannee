/**
 * Public feed ordering is derived from real published dish and recommendation
 * records only. Being tried, photographed or added never implies endorsement.
 */
export type SocialDish = {
  id: string;
  status?: "approved" | "pending" | "rejected" | string | null;
  name_en?: string | null;
  name_th?: string | null;
  photo_url?: string | null;
  price_thb?: number | null;
  comparisons_count?: number | null;
  tried_count?: number | null;
  created_at?: string | null;
  category?: { id?: string; slug?: string; name_en?: string; name_th?: string | null } | null;
  place?: {
    name?: string | null;
    area?: { id?: string; slug?: string; name_en?: string; name_th?: string | null } | null;
  } | null;
};

export type SocialPick = {
  user_id: string;
  dish_id: string;
  note: string;
  created_at: string;
  dish: {
    id: string;
    name_en: string;
    name_th?: string | null;
    photo_url?: string | null;
    place?: { name?: string | null } | null;
    category?: { name_en?: string | null; name_th?: string | null } | null;
    status?: string | null;
  };
  profile: { username: string; display_name?: string | null; avatar_url?: string | null };
};
export type SocialFeedRow =
  | { type: "pick"; id: string; pick: SocialPick }
  | { type: "discovery"; id: string; dish: SocialDish };

function time(s: string | null | undefined) {
  const n = Date.parse(s ?? "");
  return Number.isFinite(n) ? n : 0;
}

export function publishedSocialDishes(rows: readonly SocialDish[]): SocialDish[] {
  return rows.filter((dish) => dish.status === "approved" && Boolean(dish.id));
}

/** The Following tab contains explicitly authored endorsements, never tried logs. */
export function followingFeed(picks: readonly SocialPick[]): SocialFeedRow[] {
  return [...picks]
    .filter((p) => Boolean(p.dish?.id) && p.dish?.status === "approved" &&
      Boolean(p.profile?.username?.trim()))
    .sort((a, b) => time(b.created_at) - time(a.created_at))
    .slice(0, 30)
    .map((pick) => ({ type: "pick" as const, id: pick.user_id + ":" + pick.dish_id, pick }));
}

/** For You interleaves real circle recommendations and recently published dishes. */
export function forYouFeed(
  dishes: readonly SocialDish[],
  picks: readonly SocialPick[],
  count = 12,
): SocialFeedRow[] {
  const accepted = followingFeed(picks);
  const recommendedDishes = new Set(accepted.map((p) => p.type === "pick" ? p.pick.dish_id : ""));
  const discoveries: SocialFeedRow[] = publishedSocialDishes(dishes)
    .filter((d) => !recommendedDishes.has(d.id))
    .sort((a, b) => time(b.created_at) - time(a.created_at) || a.id.localeCompare(b.id))
    .slice(0, count)
    .map((dish) => ({ type: "discovery" as const, id: dish.id, dish }));
  const picksToInterleave = accepted.slice(0, count);
  const result: SocialFeedRow[] = [];
  let index = 0;
  while (result.length < count && (index < discoveries.length || index < picksToInterleave.length)) {
    if (index < picksToInterleave.length) result.push(picksToInterleave[index]);
    if (result.length < count && index < discoveries.length) result.push(discoveries[index]);
    index++;
  }
  return result;
}

/** 'Trending' is a transparent lifetime comparison-count ordering, not artificial momentum. */
export function mostComparedFeed(dishes: readonly SocialDish[], count = 12): SocialFeedRow[] {
  return publishedSocialDishes(dishes)
    .filter((d) => Number(d.comparisons_count ?? 0) > 0)
    .sort((a, b) =>
      Number(b.comparisons_count ?? 0) - Number(a.comparisons_count ?? 0) ||
      Number(b.tried_count ?? 0) - Number(a.tried_count ?? 0) ||
      a.id.localeCompare(b.id))
    .slice(0, count)
    .map((dish) => ({ type: "discovery" as const, id: dish.id, dish }));
}

export function selectedAreaFeed(
  dishes: readonly SocialDish[],
  areaSlug: string | undefined,
  count = 12,
): SocialFeedRow[] {
  if (!areaSlug) return [];
  return publishedSocialDishes(dishes)
    .filter((dish) => dish.place?.area?.slug === areaSlug)
    .sort((a, b) => time(b.created_at) - time(a.created_at) || a.id.localeCompare(b.id))
    .slice(0, count)
    .map((dish) => ({ type: "discovery" as const, id: dish.id, dish }));
}
