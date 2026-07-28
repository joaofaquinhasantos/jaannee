// Pure model for shareable cards. Rendering (canvas) and sharing (Web Share
// API) live elsewhere so this stays testable and free of browser globals.
//
// Every value here must come from real project data. There are no invented
// ranks, percentages or badges: a numeric rank is only ever included when the
// caller passes one that already cleared PUBLIC_RANK_THRESHOLD.
import { localizedName, placeDisplayName, type Bilingual, type Lang } from "@/lib/names";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

export type ShareFormat = "story" | "post" | "square";

export const SHARE_FORMATS: Record<ShareFormat, { width: number; height: number; label: string }> = {
  story: { width: 1080, height: 1920, label: "9:16" },
  post: { width: 1080, height: 1350, label: "4:5" },
  square: { width: 1080, height: 1080, label: "1:1" },
};

export type ShareDish = Bilingual & {
  id: string;
  photo_url?: string | null;
  comparisons_count?: number | null;
  place?: { name?: string | null } | null;
  category?: Bilingual | null;
  subtype?: Bilingual | null;
};

const COPY = {
  kicker_result: { en: "MY PICK", th: "จานที่ฉันเลือก" },
  kicker_rank: { en: "RANKED ON JAANNEE", th: "อันดับบน JAANNEE" },
  versus: { en: "VS", th: "VS" },
  agree: { en: "Do you agree?", th: "คุณเห็นด้วยไหม" },
  tagline: { en: "Rank the dish, not the restaurant.", th: "จัดอันดับที่จาน ไม่ใช่ที่ร้าน" },
  comparisons: { en: "diner comparisons", th: "การเปรียบเทียบจากนักชิม" },
  rank_prefix: { en: "RANK", th: "อันดับ" },
} as const;

function copy(key: keyof typeof COPY, lang: Lang): string {
  return COPY[key][lang] ?? COPY[key].en;
}

/** Human-readable pool label, e.g. "Noodles · Boat noodles". */
export function poolLabel(dish: ShareDish, lang: Lang): string {
  const category = localizedName(dish.category ?? null, lang);
  const subtype = localizedName(dish.subtype ?? null, lang);
  return [category, subtype].filter(Boolean).join(" · ");
}

export type ComparisonCardModel = {
  kind: "comparison";
  lang: Lang;
  kicker: string;
  winnerName: string;
  winnerPlace: string;
  winnerPhoto: string | null;
  loserName: string;
  loserPlace: string;
  loserPhoto: string | null;
  versus: string;
  pool: string;
  diner: string | null;
  question: string;
  tagline: string;
  url: string;
};

export function buildComparisonCard(input: {
  lang: Lang;
  winner: ShareDish;
  loser: ShareDish;
  dinerLabel?: string | null;
  url: string;
}): ComparisonCardModel {
  const { lang, winner, loser } = input;
  return {
    kind: "comparison",
    lang,
    kicker: copy("kicker_result", lang),
    winnerName: localizedName(winner, lang),
    winnerPlace: placeDisplayName(winner.place),
    winnerPhoto: winner.photo_url ?? null,
    loserName: localizedName(loser, lang),
    loserPlace: placeDisplayName(loser.place),
    loserPhoto: loser.photo_url ?? null,
    versus: copy("versus", lang),
    pool: poolLabel(winner, lang),
    diner: input.dinerLabel?.trim() ? input.dinerLabel.trim() : null,
    question: copy("agree", lang),
    tagline: copy("tagline", lang),
    url: input.url,
  };
}

export type RankingCardModel = {
  kind: "ranking";
  lang: Lang;
  kicker: string;
  rankPrefix: string;
  rank: number;
  dishName: string;
  placeName: string;
  photo: string | null;
  pool: string;
  comparisons: number;
  comparisonsLabel: string;
  tagline: string;
  url: string;
};

/**
 * Returns null when the dish is not genuinely ranked. A contender must never
 * be able to produce a card that shows a numeric rank.
 */
export function buildRankingCard(input: {
  lang: Lang;
  dish: ShareDish;
  rank: number;
  url: string;
}): RankingCardModel | null {
  const comparisons = Number(input.dish.comparisons_count ?? 0);
  if (!Number.isFinite(comparisons) || comparisons < PUBLIC_RANK_THRESHOLD) return null;
  if (!Number.isInteger(input.rank) || input.rank < 1) return null;
  const { lang } = input;
  return {
    kind: "ranking",
    lang,
    kicker: copy("kicker_rank", lang),
    rankPrefix: copy("rank_prefix", lang),
    rank: input.rank,
    dishName: localizedName(input.dish, lang),
    placeName: placeDisplayName(input.dish.place),
    photo: input.dish.photo_url ?? null,
    pool: poolLabel(input.dish, lang),
    comparisons,
    comparisonsLabel: copy("comparisons", lang),
    tagline: copy("tagline", lang),
    url: input.url,
  };
}

/** Plain-text body used for the Web Share API and clipboard fallback. */
export function shareText(model: ComparisonCardModel | RankingCardModel): string {
  if (model.kind === "comparison") {
    const lines = [
      `${model.winnerName} — ${model.winnerPlace}`.trim(),
      `${model.versus} ${model.loserName} — ${model.loserPlace}`.trim(),
      model.question,
    ];
    return lines.filter(Boolean).join("\n");
  }
  return [
    `${model.rankPrefix} #${model.rank} — ${model.dishName}`,
    model.placeName,
    `${model.comparisons} ${model.comparisonsLabel}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Absolute URL for a challenge deep link. */
export function challengeUrl(origin: string, winnerId: string, loserId: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/challenge/${winnerId}/${loserId}?pick=${winnerId}`;
}
