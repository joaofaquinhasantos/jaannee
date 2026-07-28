import type { Key } from "./i18n";
import { PUBLIC_RANK_THRESHOLD } from "./ranking";

export function dishStatusLabel(
  dish: {
    needs_update?: boolean | null;
    comparisons_count?: number | null;
    elo?: number | null;
  },
  t: (key: Key) => string,
) {
  const count = dish.comparisons_count ?? 0;
  if (dish.needs_update) return { text: t("status_needs_update"), tone: "amber" as const };
  if (count < PUBLIC_RANK_THRESHOLD) {
    return {
      text: count === 0 ? t("status_new") : t("status_gathering"),
      tone: "neutral" as const,
    };
  }
  if ((dish.elo ?? 1000) >= 1100) {
    return { text: t("status_top"), tone: "primary" as const };
  }
  return { text: t("status_ranked"), tone: "primary" as const };
}

export function toneClass(tone: "amber" | "neutral" | "primary") {
  return tone === "primary"
    ? "bg-primary/10 text-primary"
    : tone === "amber"
      ? "bg-accent/20 text-accent-foreground"
      : "bg-muted text-muted-foreground";
}
