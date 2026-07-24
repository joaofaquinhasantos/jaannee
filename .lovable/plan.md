## What I reviewed

I walked Discover, Rankings, Compare, Submit, and Auth on desktop (1280w) and mobile (390w), signed-out. Since the database was just reset, every list surface is at its empty state — which is actually useful, because that's what any first-time visitor sees today.

## What's working

- **Voice is strong and distinctive.** "The board is hungry," "Rank the dish, not the restaurant," "Bangkok dish board." The editorial serif + warm cream/chili palette holds together and doesn't feel AI-generic.
- **Mobile bottom nav is the right call** (Discover / Rankings / Compare / Add). Thumb-reachable, matches the "quick vote between bites" use case.
- **Empty state on Discover is on-brand** ("The board is hungry") and gives two next actions instead of a dead end.
- **Auth is low-friction** — magic link + Google, no password field.
- **Compare's copy is smart** — "Sign in only when your vote needs saving" removes a common friction blocker.

## Priority issues

### P0 — blocks first use

1. **Homepage "01 / 02 / 03" cards are empty boxes.** Big numerals + a label (NOMINATE / COMPARE / RANK) with no body copy underneath. Reads like a broken component, not a how-it-works. Either fill each card with one sentence, or remove them.
2. **Rankings page has no path forward when empty.** "SELECTED BOARD" with two dashes and "Help rank this board" is confusing before any board is even picked. Should either auto-pick a default board or hide the card until a filter is chosen.
3. **Compare page dead-ends on "Choose category" with no hint.** After the picker there's nothing — no list of categories, no "here's what's poppable now." A first-time user has no way to start comparing without knowing the taxonomy.
4. **"Add a dish" gate is a hard stop, not a soft one.** Full-viewport "Sign in to post a dish" for a signed-out user. On mobile especially it looks like the app is broken. Better: show the actual form disabled or preview-only, with the sign-in CTA inline.

### P1 — friction and polish

5. **Header on desktop is cluttered at the top-left.** "JaanNee" logo + "Rank the dish, not the restaurant." tagline wraps to two lines and pushes into the nav. Either drop the tagline in the header (keep it on the home hero) or move it below the logo only on the home page.
6. **Two "Sign in" affordances on the same page** (top-right + card CTA on Compare/Rankings). Pick one primary; demote the other.
7. **"BANGKOK DISH BOARD" / "LIVE CHART" / "HEAD TO HEAD" / "JOIN THE BOARD" eyebrows** are all styled identically in chili red uppercase. They start to feel decorative rather than informational — consider using them only where they add real context.
8. **Empty filter chips ("More categories", "More areas") look like disabled inputs**, not searchable pickers. A magnifier icon inside a field with placeholder text reads as "search that returned nothing." Add a subtle "▾" or "Browse" affordance.
9. **The homepage hero H1 "What should people eat in Bangkok?"** is Bangkok-scoped but the app is nationwide (Thailand). Either commit to Bangkok as the launch city, or rotate the question by selected area.
10. **Discover title reads "Discover" both in the nav tab AND as an H2 below.** Redundant; the section heading can be more specific ("Fresh plates," "Recently added," "By category").

### P2 — nice to have

11. **No visible loading skeletons** during route transitions on slow connections — routes just pop.
12. **Language toggle "TH"** is a chip in the header but doesn't preview what will change. Consider showing "EN | TH" so the current language is obvious.
13. **Bottom nav has no active-tab underline treatment on desktop equivalents.** Desktop uses a filled pill; mobile bottom nav uses color-only. Match one pattern.
14. **No favicon-scale brand mark yet** — the wordmark is nice but doesn't reduce to an icon for share cards or the MCP catalog entry.

## Suggested next batch

If you want, I can turn P0 into one focused build batch (roughly: fill or remove the 01/02/03 how-it-works cards, add a default-board fallback on Rankings, add a category grid to Compare, and convert the Submit sign-in gate to an inline soft-gate). That's the smallest change that fixes "first-visit looks broken."

## Not touched in this review

- Signed-in flows (dish detail, admin, submit form itself, share button, actual comparison UI) — the reset means there's no data to render them against. Say the word and I'll seed a handful of test dishes and review those too.
- Copy translation quality (TH) — needs a native speaker pass, not a UX pass.

Approve and I'll ship the P0 fixes; or tell me which items to keep, drop, or reorder.
