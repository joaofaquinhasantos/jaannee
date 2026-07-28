import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

// Pure helpers for contextual comparison eligibility.
//
// Ranking-pool rule (product invariant): a pool is category-only unless the
// category is subtype-scoped, in which case the pool is category + subtype.
// Two dishes may only be compared when they share the exact same pool, are
// both approved, are both marked tried by the signed-in diner, and have not
// already been compared by that diner.
//
// These helpers never write anything and never relax a server-side rule —
// the server function `submitComparison` and the database triggers remain
// the authority. They exist so the UI can offer only pairs that will pass.

export type PairSubtype = { id?: string | null; is_active?: boolean | null } | null;

export type PairDish = {
  id: string;
  status?: string | null;
  comparisons_count?: number | null;
  subtype_id?: string | null;
  category?: { id?: string | null; requires_subtype?: boolean | null } | null;
  subtype?: PairSubtype;
};

/**
 * Stable identifier for a ranking pool, or null when the dish cannot take
 * part in any pool (not approved, no category, inactive subtype).
 */
export function poolKey(dish: PairDish | null | undefined): string | null {
  if (!dish) return null;
  if (dish.status && dish.status !== "approved") return null;
  const categoryId = dish.category?.id;
  if (!categoryId) return null;
  const subtypeId = dish.subtype_id ?? dish.subtype?.id ?? null;
  if (subtypeId) {
    // A subtype-bearing dish only counts while its subtype is active.
    if (dish.subtype && dish.subtype.is_active !== true) return null;
    return `${categoryId}|${subtypeId}`;
  }
  // A category that demands a subtype cannot be pooled without one.
  if (dish.category?.requires_subtype === true) return null;
  return `${categoryId}|`;
}

/** Order-independent key for a compared pair. */
export function pairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

/** True when both dishes sit in the exact same, valid ranking pool. */
export function isSamePool(a: PairDish | null | undefined, b: PairDish | null | undefined): boolean {
  if (!a || !b || a.id === b.id) return false;
  const ka = poolKey(a);
  const kb = poolKey(b);
  return ka !== null && ka === kb;
}

export type EligiblePair<T extends PairDish> = { a: T; b: T; poolKey: string };

/**
 * Every eligible pair among the diner's tried dishes, excluding pairs the
 * diner already compared. Pairs are returned in a deterministic order.
 */
export function findEligiblePairs<T extends PairDish>(
  dishes: readonly T[],
  comparedPairKeys: Iterable<string> = [],
): EligiblePair<T>[] {
  const done = new Set(comparedPairKeys);
  const byPool = new Map<string, T[]>();
  for (const dish of dishes) {
    const key = poolKey(dish);
    if (!key) continue;
    const bucket = byPool.get(key);
    if (bucket) bucket.push(dish);
    else byPool.set(key, [dish]);
  }
  const pairs: EligiblePair<T>[] = [];
  for (const [key, bucket] of [...byPool.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    const sorted = [...bucket].sort((x, y) => x.id.localeCompare(y.id));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (done.has(pairKey(sorted[i].id, sorted[j].id))) continue;
        pairs.push({ a: sorted[i], b: sorted[j], poolKey: key });
      }
    }
  }
  return pairs;
}

/** The single pair to surface as "Ready to compare", or null. */
export function firstEligiblePair<T extends PairDish>(
  dishes: readonly T[],
  comparedPairKeys: Iterable<string> = [],
): EligiblePair<T> | null {
  return findEligiblePairs(dishes, comparedPairKeys)[0] ?? null;
}

/**
 * Prefer the eligible pair with the greatest real ranking impact. A
 * comparison increments both dishes, so a pair containing a dish at four
 * comparisons can immediately unlock its public rank. Ties remain
 * deterministic and never use provisional Elo.
 */
export function bestEligiblePair<T extends PairDish>(
  dishes: readonly T[],
  comparedPairKeys: Iterable<string> = [],
): EligiblePair<T> | null {
  const pairs = findEligiblePairs(dishes, comparedPairKeys);
  return (
    pairs.sort((left, right) => {
      const rightCounts = [
        Number(right.a.comparisons_count ?? 0),
        Number(right.b.comparisons_count ?? 0),
      ].sort((a, b) => b - a);
      const leftCounts = [
        Number(left.a.comparisons_count ?? 0),
        Number(left.b.comparisons_count ?? 0),
      ].sort((a, b) => b - a);
      return (
        rightCounts[0] - leftCounts[0] ||
        rightCounts[1] - leftCounts[1] ||
        pairKey(left.a.id, left.b.id).localeCompare(pairKey(right.a.id, right.b.id))
      );
    })[0] ?? null
  );
}

export type PairRankOpportunity = {
  comparisonsRemaining: number;
  unlocksRankNow: boolean;
  almostRanked: boolean;
};

export function pairRankOpportunity<T extends PairDish>(
  pair: EligiblePair<T> | null | undefined,
): PairRankOpportunity | null {
  if (!pair) return null;
  const closestCount = Math.max(
    Number(pair.a.comparisons_count ?? 0),
    Number(pair.b.comparisons_count ?? 0),
  );
  const comparisonsRemaining = Math.max(0, PUBLIC_RANK_THRESHOLD - closestCount);
  return {
    comparisonsRemaining,
    unlocksRankNow: comparisonsRemaining === 1,
    almostRanked: comparisonsRemaining > 0 && comparisonsRemaining <= 2,
  };
}

/**
 * Eligible partners for one specific dish — used by Dish Detail and by the
 * "you just marked a second dish tried" drawer.
 */
export function eligiblePartnersFor<T extends PairDish>(
  dishId: string,
  dishes: readonly T[],
  comparedPairKeys: Iterable<string> = [],
): T[] {
  const done = new Set(comparedPairKeys);
  const target = dishes.find((d) => d.id === dishId);
  if (!target) return [];
  const key = poolKey(target);
  if (!key) return [];
  return dishes
    .filter((d) => d.id !== dishId && poolKey(d) === key && !done.has(pairKey(dishId, d.id)))
    .sort((x, y) => x.id.localeCompare(y.id));
}
