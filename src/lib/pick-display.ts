import type { PublicPick } from "@/lib/recommendations.functions";

export type GroupedPick = {
  dish: PublicPick["dish"];
  supporters: PublicPick[];
  mostRecent: string;
};

/** Social proof reflects unique, explicit recommendations, never just a try. */
export function groupFollowingPicks(picks: PublicPick[], limit = 6): GroupedPick[] {
  const groups = new Map<string, GroupedPick>();
  for (const pick of picks) {
    if (!pick.dish?.id || !pick.profile?.username || pick.dish.status !== "approved") continue;
    let group = groups.get(pick.dish.id);
    if (!group) {
      group = { dish: pick.dish, supporters: [], mostRecent: pick.created_at };
      groups.set(pick.dish.id, group);
    }
    if (!group.supporters.some((supporter) => supporter.user_id === pick.user_id)) {
      group.supporters.push(pick);
    }
    if (pick.created_at > group.mostRecent) group.mostRecent = pick.created_at;
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.supporters.length - a.supporters.length ||
      b.mostRecent.localeCompare(a.mostRecent) ||
      a.dish.id.localeCompare(b.dish.id),
  ).slice(0, limit);
}
