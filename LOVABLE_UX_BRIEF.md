# JaanNee UX Improvement Brief

Use this brief for the next Lovable UX iteration. Preserve the current visual identity, data model, duplicate detection logic, Elo/ranking keys, comparison validation, and 5-comparison threshold.

## Priority 1: Make Add A Dish Fast

The submit flow currently feels like filling a database form. It should feel closer to posting a food photo.

Default first screen:

- Photo
- Dish name
- Place name
- Category
- Primary action: `Post dish` or `Add to board`

Move these behind a collapsed `Add details` section:

- Thai dish name
- Price
- Area/address
- Dish type/subtype
- Note

Behavior:

- If an existing place is selected, auto-use its area.
- If the place is new, ask for area only after the user has started entering the core dish/place fields.
- If a category has required subtypes, ask for dish type contextually after category is picked.
- Keep the existing server-side validation and moderation flow intact.

## Priority 2: Reduce Login Friction

- Let users express intent before sign-in wherever practical.
- For submit, ideally let users fill the dish first and ask them to sign in only when they tap the final post action.
- If the submit route must stay protected, improve the sign-in page copy for `Add a dish` so the value is clear.
- For Compare logged-out state, explain: signing in lets users cast votes and build the rankings.

## Priority 3: Improve Empty States

- Rankings empty state should be compact and actionable, especially on mobile.
- Keep `Add a dish` and `Compare dishes` visible without pushing them into the bottom nav area.
- If there are unranked candidates in the selected category/pool, show a compact `Help rank these dishes` section.
- Keep rank positions hidden until the existing 5-comparison threshold is met.

## Priority 4: Strengthen The Core Loop

- Add or expose an `I ate this` / tried action wherever dish cards appear, using the existing `toggleTried` flow.
- After dish detail, compare, and discover browsing, gently nudge users toward adding a missing or better dish.
- Keep nudges short and utility-focused.

## Priority 5: Tighten Mobile Layout

- Home hero is too tall before users reach actual dishes.
- Reduce the mobile footprint of the hero/process cards, or move the 01/02/03 process cards below the first dish list.
- Prevent category chips from being awkwardly clipped on mobile.
- Prefer smoother horizontal scrolling or a compact search/drawer pattern as category count grows.

## Priority 6: Improve Food Trust

- Real food photos matter more than more features.
- Do not invent fake dish photos.
- Make missing-photo placeholders less dominant and less repetitive.
- Preserve uploaded photo handling and admin photo flow.

## Top Three Next Fixes

1. Simplify Submit into a fast, photo-first flow.
2. Make empty Rankings actionable with unranked candidates and clear CTAs.
3. Make dish cards more engaging with real photos and `I ate this`.
