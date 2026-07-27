import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

export { PUBLIC_RANK_THRESHOLD };

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const dishSelect = `
  id, name_en, name_th, price_thb, photo_url, note, status, elo, comparisons_count,
  subtype_id,
  needs_update, created_at, submitted_by,
  category:categories(id, slug, name_en, name_th),
  subtype:dish_subtypes(id, slug, name_en, name_th, is_active),
  place:places(id, name, address, lat, lng, area:areas(id, slug, name_en, name_th))
`;

// Same shape but with an inner join on places so we can filter dishes by
// place.area_id server-side (outer joins can't be filtered without dropping
// dishes whose place row would otherwise be null).
const dishSelectInner = `
  id, name_en, name_th, price_thb, photo_url, note, status, elo, comparisons_count,
  subtype_id,
  needs_update, created_at,
  category:categories(id, slug, name_en, name_th),
  subtype:dish_subtypes(id, slug, name_en, name_th, is_active),
  place:places!inner(id, name, address, lat, lng, area:areas(id, slug, name_en, name_th))
`;

export function mapsDirectionsUrl(place: { name?: string | null; address?: string | null; lat?: number | null; lng?: number | null }) {
  const query =
    place.lat != null && place.lng != null
      ? `${place.lat},${place.lng}`
      : [place.name, place.address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

async function withTriedCounts<T extends { id: string }>(
  supabase: ReturnType<typeof publicClient>,
  rows: T[],
): Promise<Array<T & { tried_count: number }>> {
  if (rows.length === 0) return rows as Array<T & { tried_count: number }>;
  const ids = rows.map((row) => row.id).filter(Boolean);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("get_dish_tried_counts", { _dish_ids: ids });
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { dish_id: string; tries_count: number }[]) {
    counts[row.dish_id] = Number(row.tries_count) || 0;
  }
  return rows.map((row) => ({ ...row, tried_count: counts[row.id] ?? 0 }));
}

// Public discovery ordering. Ranked dishes (>= PUBLIC_RANK_THRESHOLD
// comparisons) come first, ordered by Elo desc, then comparisons desc,
// then created_at desc, then id. Unranked contenders come after, ordered
// by comparisons desc, then tried_count desc, then created_at desc, then
// id. Elo is never used to order contenders.
function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dateTs(v: unknown): number {
  if (typeof v !== "string" && !(v instanceof Date)) return 0;
  const t = new Date(v as string).getTime();
  return Number.isFinite(t) ? t : 0;
}

export type DiscoveryRow = {
  id?: string | null;
  elo?: number | null;
  comparisons_count?: number | null;
  tried_count?: number | null;
  created_at?: string | null;
};

export function orderDiscoveryDishes<T extends DiscoveryRow>(rows: T[]): T[] {
  const ranked: T[] = [];
  const contenders: T[] = [];
  for (const row of rows) {
    if (num(row.comparisons_count) >= PUBLIC_RANK_THRESHOLD) ranked.push(row);
    else contenders.push(row);
  }
  ranked.sort((a, b) => {
    const eloDiff = num(b.elo) - num(a.elo);
    if (eloDiff !== 0) return eloDiff;
    const cmpDiff = num(b.comparisons_count) - num(a.comparisons_count);
    if (cmpDiff !== 0) return cmpDiff;
    const dateDiff = dateTs(b.created_at) - dateTs(a.created_at);
    if (dateDiff !== 0) return dateDiff;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
  contenders.sort((a, b) => {
    const cmpDiff = num(b.comparisons_count) - num(a.comparisons_count);
    if (cmpDiff !== 0) return cmpDiff;
    const triedDiff = num(b.tried_count) - num(a.tried_count);
    if (triedDiff !== 0) return triedDiff;
    const dateDiff = dateTs(b.created_at) - dateTs(a.created_at);
    if (dateDiff !== 0) return dateDiff;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
  return [...ranked, ...contenders];
}

const imageUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine(
    (v) => {
      if (!v) return true;
      if (/^\/photos\/[A-Za-z0-9._~!$&'()*+,;=:@/-]+$/i.test(v)) return true;
      if (!/^https?:\/\//i.test(v)) return false;
      try {
        const url = new URL(v);
        const imageExt = /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(url.pathname);
        const knownImageHost =
          /(^|\.)((cloudinary\.com)|(images\.unsplash\.com)|(imgur\.com)|(i\.imgur\.com)|(supabase\.co)|(lovableproject\.com))$/i.test(
            url.hostname,
          );
        return imageExt || knownImageHost;
      } catch {
        return false;
      }
    },
    { message: "Use an uploaded photo, a /photos/ path, or a direct image URL." },
  );

const optionalUuidSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().uuid().optional(),
);

export const listDishes = createServerFn({ method: "GET" })
  .inputValidator((i: { categorySlug?: string; areaSlug?: string; subtypeSlug?: string }) => i ?? {})
  .handler(async ({ data }) => {
    const supabase = publicClient();
    if (data.subtypeSlug && !data.categorySlug) return [];
    // Resolve slug filters to ids so filtering runs in Postgres, not JS.
    const [catRes, areaRes] = await Promise.all([
      data.categorySlug
        ? supabase.from("categories").select("id, requires_subtype").eq("slug", data.categorySlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      data.areaSlug
        ? supabase.from("areas").select("id").eq("slug", data.areaSlug).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);
    if (data.categorySlug && !catRes.data) return [];
    if (data.areaSlug && !areaRes.data) return [];
    // Detect subtype scoping so we never mix pools by Elo.
    let scoped = false;
    if (catRes.data) {
      const { data: activeSubs } = await supabase
        .from("dish_subtypes")
        .select("id")
        .eq("category_id", catRes.data.id)
        .eq("is_active", true);
      scoped = Boolean((catRes.data as any).requires_subtype) || (activeSubs ?? []).length > 0;
    }
    // Category-only pool: reject any supplied subtype filter.
    if (data.subtypeSlug && catRes.data && !scoped) return [];
    const subtypeRes =
      data.subtypeSlug && catRes.data
        ? await supabase
            .from("dish_subtypes")
            .select("id")
            .eq("category_id", catRes.data.id)
            .eq("slug", data.subtypeSlug)
            .eq("is_active", true)
            .maybeSingle()
        : { data: null, error: null };
    if (data.subtypeSlug && !subtypeRes.data) return [];
    if (data.categorySlug && !data.subtypeSlug && scoped && !data.subtypeSlug) {
      // Subtype-scoped category selected without a subtype: do not order
   8ó®x¶‰žËkºwµçr className="font-display text-3xl leading-tight">{t("no_ranked_yet_title")}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">{t("no_ranked_yet_body")}</p>
                        </>
                      ) : (
                        <>
                          <h2 className="font-display text-3xl leading-tight">{t("new_contenders")}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">{t("new_contenders_body")}</p>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {contenders.map((d: any) => (
                        <DishCard key={d.id} dish={d} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            );
          })()
        )}
      </section>
      {(activity.data ?? []).length > 0 && (
        <section className="mt-8 md:mt-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl leading-none">Taste feed</h2>
            {authed ? (
              <div className="flex rounded-full border border-border bg-card p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFollowingOnly(false)}
                  className={`rounded-full px-3 py-1 ${!followingOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFollowingOnly(true)}
                  className={`rounded-full px-3 py-1 ${followingOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Following
                </button>
              </div>
            ) : (
              <span className="text-xs font-bold uppercase text-muted-foreground">People eating now</span>
            )}
          </div>
          <div className="space-y-2">
            {(activity.data ?? []).slice(0, 6).map((item: any, i: number) => (
              <Link
                key={`${item.type}-${item.dish?.id}-${item.created_at}-${i}`}
                to="/dish/$id"
                params={{ id: item.dish.id }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-lg text-muted-foreground">
                  {(item.profile?.display_name || item.profile?.username || "J").slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {item.profile?.display_name || item.profile?.username || "Someone"}{" "}
                    <span className="font-normal text-muted-foreground">
                      {item.type === "tried" ? "tried" : "posted"}
                    </span>{" "}
                    {item.dish?.name_en}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.dish?.place?.name}{item.body ? ` / "${item.body}"` : ""}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <Link
        to="/submit"
        className="fixed bottom-28 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl font-semibold leading-none text-primary-foreground shadow-[0_16px_35px_rgba(218,43,31,0.3)] md:hidden"
        aria-label="Add a dish"
      >
        +
      </Link>
    </AppShell>
  );
}

function TrustSignal({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 font-semibold">
      {text}
    </div>
  );
}

function EditorialEmpty({
  title,
  body,
  primary,
  secondary,
  onSecondary,
}: {
  title: string;
  body: string;
  primary: string;
  secondary: string;
  onSecondary: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid md:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-border bg-secondary p-6 md:border-b-0 md:border-r">
          <span className="font-display text-7xl leading-none text-accent">00</span>
          <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">No verdict yet</p>
        </div>
        <div className="p-6 md:p-8">
          <h2 className="font-display text-4xl leading-tight">{title}</h2>
          <p className="mt-3 max-w-lg leading-7 text-muted-foreground">{body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/submit">
              <Button>{primary}</Button>
            </Link>
            <Button variant="outline" onClick={onSecondary}>{secondary}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  variant = "primary",
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const base = "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors";
  const on =
    variant === "primary"
      ? "border-primary bg-primary text-primary-foreground"
      : "border-accent bg-accent text-accent-foreground";
  const off = "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground";
  return (
    <button onClick={onClick} className={`${base} ${active ? on : off}`}>
      {children}
    </button>
  );
}
