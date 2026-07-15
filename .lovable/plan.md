# JaanNee — Build Plan (v1)

## Stack

TanStack Start + Lovable Cloud (Postgres, Storage, magic-link auth). Mobile-first, warm chili-red/gold palette, i18n-ready (en/th) via a simple dictionary.

## Database (single migration)

- `profiles` (id → auth.users, display_name)
- `app_role` enum + `user_roles` + `has_role()` SECURITY DEFINER
- `categories` (slug, name_en, name_th) — user seeds via admin
- `areas` (slug, name_en, name_th)
- `places` (name, area_id, address)
- `dishes` (name_en, name_th, place_id, category_id, price_thb, photo_url, note, status: pending/approved/rejected, submitted_by, elo numeric default 1000, comparisons_count int, timestamps)
- `dish_tries` (user_id, dish_id) — unique per user
- `comparisons` (user_id, category_id, dish_lo_id, dish_hi_id, winner_id, timestamps) — unique on (user_id, dish_lo_id, dish_hi_id) enforcing "one comparison per unordered pair per user"
- `reports` (dish_id, user_id, reason, note, status)
- Storage bucket `dish-photos` (public read; authenticated upload)
- RLS: public SELECT approved dishes/places/categories/areas; user reads own pending; admins full access via `has_role`. Comparisons/tries writable by owner only. Reports insertable by authenticated.

## Server functions (`src/lib/*.functions.ts`)

- `listDishes({ categorySlug?, areaSlug? })` public — approved only, joined with place/area/category
- `getDish(id)` public
- `searchSimilar({ placeName?, dishName? })` — duplicate hint
- `submitDish(...)` auth — inserts pending
- `markTried(dishId)` / `unmarkTried` auth
- `submitComparison({ dishAId, dishBId, winnerId })` auth — upserts unordered pair, recomputes Elo for both dishes atomically (server-side, admin client)
- `myProfile()` auth — tries + comparisons list
- `leaderboard({ categorySlug, areaSlug })` public — approved dishes with ≥5 comparisons ordered by elo
- Admin: `listPending()`, `approveDish(id)`, `rejectDish(id)`, `listReports()`, `resolveReport(id)`, `bulkImportCsv(csv)` — all gated by `has_role(admin)`

## Routes

- `/` — feed with category + area filters, dish cards
- `/dish/$id` — detail, "I tried this", "Compare this dish"
- `/submit` — auth-gated form with duplicate-check step
- `/compare` — pick two dishes in same category, choose winner
- `/rankings` — leaderboard per category/area combo
- `/profile` — my tried & compared
- `/admin` — pending queue, reports, CSV importer (admin only)
- `/auth` — magic link
- `_authenticated` layout for gated routes

## Design system

- Cream `#FBF7F0`, chili red `#C5342A` primary, muted gold `#B8873B` accent, charcoal text
- Rounded 12–16px, subtle shadow, large touch targets, dish photo as card hero
- Serif display font (Fraunces) + clean sans (Inter) via `<link>` in root head
- All colors as oklch tokens in `src/styles.css`

## i18n

Simple `t(key, lang)` dictionary in `src/lib/i18n.ts` with a `LanguageContext` (en/th toggle in header, persisted in localStorage read in useEffect).

## Out of scope for v1 (per spec)

Restaurants/portals, payments, star ratings, reviews, social, badges, seed data.