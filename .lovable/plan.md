## Scope

Presentation-only refactor of the Categories section in `src/routes/_authenticated/admin.tsx` (Taxonomy tab, ~lines 806–848). No changes to queries, mutations, `groupedCategories`, upsert logic, validation, or data shape.

## Changes

### 1. Collapsible cuisine sections
Wrap each cuisine group returned by `groupedCategories(cats.data ?? [], catFilter)` in a `<details>` element (native, zero deps, keyboard-accessible).

- `<summary>` shows: `{cuisineLabel(cuisine, t)} — {rows.length} categories` with a chevron.
- Collapsed by default (no `open` attribute).
- One cuisine can be expanded independently; no accordion single-open constraint (spec says "Tap to expand one cuisine at a time" — interpreted as user-driven, not enforced).

### 2. Hide Dish Types behind per-row toggle
Replace the always-rendered Dish Types block (lines 825–842) with a `<details>` inside the category row.

- `<summary>` renders as a small "Manage types" button-styled toggle, with a count suffix when subtypes exist (e.g. "Manage types (3)").
- Collapsed by default. When open, renders the same Add-type button + subtype list + empty state that exists today, untouched.

### 3. Filter behavior
`catFilter` already filters via `groupedCategories(..., catFilter)`. Add auto-expand:

- When `catFilter.trim() !== ""`, render cuisine `<details>` with `open` forced on (via `open={hasFilter}` prop) so any cuisine returned by the filter is expanded.
- Filter already matches EN, TH, and slug via `matchesCategory` in `CategoryPicker.tsx`. Cuisine name matching: extend the local filter check so a cuisine label match also expands/keeps that group — done by testing `cuisineLabel(cuisine, t)` against the query and, if it matches, showing all rows in that group. Implemented as a small wrapper around `groupedCategories` result inside the component (presentational filter, no data change).

### 4. Untouched
- Add-category form (lines 781–805) stays as-is at top.
- Cuisines block, Areas block, Add-dish-type dialog, Edit/Delete dialogs — unchanged.
- All mutations, query keys, invalidations — unchanged.

## Technical notes

- Use `<details>`/`<summary>` with Tailwind `[&_summary]:list-none`, a rotating `ChevronRight` (lucide, already used elsewhere), and `group` + `group-open:rotate-90` for the chevron.
- No new state, no new deps, no new hooks beyond deriving `hasFilter = catFilter.trim().length > 0`.
- Diff confined to the JSX block at lines ~809–846 plus the small cuisine-label filter helper defined inline in the component.
