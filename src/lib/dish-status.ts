export function dishStatusLabel(d: { needs_update?: boolean; comparisons_count?: number; elo?: number }, t: (k: any) => string) {
  const count = d.comparisons_count ?? 0;
  if (d.needs_update) return { text: t("status_needs_update"), tone: "amber" as const };
  if (count < 5) return { text: count === 0 ? t("status_new") : t("status_gathering"), tone: "neutral" as const };
  if ((d.elo ?? 1000) >= 1100) return { text: t("status_top"), tone: "primary" as const };
  return { text: t("status_gathering"), tone: "neutral" as const };
}

export function toneClass(tone: "amber" | "neutral" | "primary") {
  return tone === "primary"
    ? "bg-primary/10 text-primary"
    : tone === "amber"
      ? "bg-accent/20 text-accent-foreground"
      : "bg-muted text-muted-foreground";
}