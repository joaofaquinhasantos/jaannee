# JaanNee — Permanent product rules

> **Rank the dish, not the restaurant. Rank the specific variant, not the bucket.**

These rules are load-bearing product invariants. Every change to code, schema, or MCP tools must preserve them. If a request appears to conflict with a rule below, ask before implementing.

## 1. Ranking is diner-generated, only
- Elo movement comes exclusively from pairwise comparisons submitted by authenticated diners.
- Admins cannot boost, seed, or hand-edit Elo. There is no admin "rank" UI and no server function that writes to `dishes.elo` outside the `apply_elo` RPC invoked by `submitComparison`.
- `apply_elo` and `admin_merge_dishes` are `service_role`-only.

## 2. Tried before voting
- A user can only vote in a pairwise comparison when they have marked **both** dishes as tried.
- Enforced by DB trigger `trg_comparisons_tried`; `submitComparison` also validates and returns a friendly error.
- `/compare` pickers must only offer dishes the current user has tried.

## 3. Ranking pools
The smallest identical unit that can be compared apples-to-apples:
- If a category has `requires_subtype = true` OR any active sub-types, the pool is **(category, sub-type)** (e.g. Sushi → Nigiri Salmon).
- Otherwise the pool is **(category)** (e.g. Pad Thai).

Rules: comparisons rejected unless both dishes share the same pool; leaderboards operate on one pool per query; MCP `list_dishes` and `leaderboard` require `subtypeSlug` when the category is subtype-scoped.

## 4. Rankability threshold
- A dish is publicly ranked only after **≥5 comparisons**.
- Public discovery shows two segments: ranked (by Elo desc) then unranked (by `tried_count` desc). Never mix them.
- Status labels come from `statusLabel()` in `src/components/DishCard.tsx`. Never render raw `comparisons_count` in a card badge.

## 5. Sub-type enforcement at approval
- A dish in a category with `requires_subtype` or any active sub-types cannot be approved without a valid, active sub-type belonging to the same category. Enforced by `trg_dishes_approval_subtype`.

## 6. Duplicate prevention
- `(place_id, normalize_dish_name(name_en))` is a unique index on non-rejected dishes. Duplicate submissions raise `23505` and are mapped to "This dish already exists at the selected restaurant."

## 7. Safe destructive operations
- A dish **cannot be deleted** if any comparisons reference it
  (`trg_dishes_delete_guard`). Zero-comparison dishes may be deleted;
  the FK cascade removes their tried-marks and reports. Dishes with
  ranking history are protected and cannot be deleted **or** merged.
- Merging goes through `public.admin_merge_dishes(keep, remove)` and is
  **only allowed before either dish has any comparison history**. It
  requires the same place, category, and sub-type (null-safe), then
  transfers tried-marks and reports to the keeper and deletes the
  duplicate — atomically. Comparison rows, Elo, and `comparisons_count`
  are **never** rewritten or deleted by merge.

## 8. Photos
- `dish-photos` bucket is private; served through `/photos/*` proxy with long cache headers.
- Client uploads validate size ≤8MB and MIME in {`image/jpeg`, `image/png`, `image/webp`}.
- Proxy sends `X-Content-Type-Options: nosniff` and only serves the three allowed content types.

## 9. Wording
- "Diner" = a person. "Comparison" = a vote event. Never write "5 diners" when the count is comparisons, and vice versa.

## 10. MCP tools
- All MCP tools run under the caller's OAuth bearer via RLS. Never service-role.
- Tools that touch rankability respect §3 and §4 (pool + threshold).
- `list_categories` returns `requires_subtype` and active sub-types so the caller can request the right pool.

---
Any PR that touches ranking, comparisons, sub-types, deletion/merge, or photo handling must be checked against this file.
