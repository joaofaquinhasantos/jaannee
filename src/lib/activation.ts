// First-session activation: a visitor can mark dishes as tried before they
// have an account. Selections are held in localStorage only and are applied
// to the real account through the existing `toggleTried` server function
// after authentication. No comparison is ever stored before sign-in.
const KEY = "jn_pending_tried";
const DISMISS_KEY = "jn_activation_dismissed";
const MAX_PENDING = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPendingTried(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((v): v is string => typeof v === "string" && UUID.test(v)))].slice(
      0,
      MAX_PENDING,
    );
  } catch {
    return [];
  }
}

export function writePendingTried(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const clean = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, MAX_PENDING);
    window.localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* storage unavailable — activation is best-effort */
  }
}

export function clearPendingTried(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function togglePendingTried(id: string): string[] {
  const current = readPendingTried();
  const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
  writePendingTried(next);
  return next;
}

export function isActivationDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissActivation(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Only same-origin absolute paths may be used as a post-auth return URL. */
export function safeReturnPath(path: string | null | undefined, fallback = "/"): string {
  if (typeof path !== "string") return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path.includes("\\")) return fallback;
  return path;
}
