// Bilingual display helpers. Dynamic taxonomy / dish rows carry `name_en`
// and an optional `name_th`. In Thai mode we prefer the Thai field and fall
// back to English; in English mode we prefer English and fall back to Thai
// so a Thai-first submission is never rendered blank.
export type Lang = "en" | "th";

export type Bilingual = {
  name_en?: string | null;
  name_th?: string | null;
};

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Primary display name for the active language, with cross-language fallback. */
export function localizedName(row: Bilingual | null | undefined, lang: Lang): string {
  if (!row) return "";
  const en = clean(row.name_en);
  const th = clean(row.name_th);
  if (lang === "th") return th ?? en ?? "";
  return en ?? th ?? "";
}

/**
 * Secondary name to show under the primary one, or null when there is no
 * distinct second-language value.
 */
export function secondaryName(row: Bilingual | null | undefined, lang: Lang): string | null {
  if (!row) return null;
  const primary = localizedName(row, lang);
  const en = clean(row.name_en);
  const th = clean(row.name_th);
  const other = lang === "th" ? en : th;
  if (!other || other === primary) return null;
  return other;
}

/**
 * Restaurant / stall proper names are never translated. Places only have a
 * single `name` column, so this simply normalises it.
 */
export function placeDisplayName(place: { name?: string | null } | null | undefined): string {
  return clean(place?.name) ?? "";
}
