import type { DemoDish, DemoPerson } from "./demo-data";

/** Count deliberate endorsements, never tried marks or simulated comparison scores. */
export function countTrustedDemoPicks(
  people: readonly DemoPerson[],
  following: ReadonlySet<string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const person of people) {
    if (!following.has(person.username)) continue;
    // A diner cannot give two votes to the same recommendation tally.
    for (const dishId of new Set(person.picks.map((pick) => pick.dishId))) {
      counts.set(dishId, (counts.get(dishId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Personal discovery is deliberately separate from the community leaderboard. */
export function discoverTrustedDemoDishes(
  dishes: readonly DemoDish[],
  counts: ReadonlyMap<string, number>,
): DemoDish[] {
  return dishes
    .filter((dish) => (counts.get(dish.id) ?? 0) > 0)
    .sort((a, b) =>
      (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
      b.score - a.score ||
      a.id.localeCompare(b.id),
    );
}

/**
 * The real ranking mechanic is only available when a diner has tried both
 * distinct dishes in the same dish type. Keep the demo faithful to that rule.
 */
export function canCompareDemoDishes(
  first: DemoDish,
  second: DemoDish,
  triedIds: ReadonlySet<string>,
): boolean {
  return first.id !== second.id &&
    first.category === second.category &&
    triedIds.has(first.id) &&
    triedIds.has(second.id);
}
