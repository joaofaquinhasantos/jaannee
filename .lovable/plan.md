# JaanNee Integrity Hardening

One coordinated update. No automatic migrations, no automatic publishing and no database resets.

Every database change must be delivered as manual SQL in `supabase/manual/` for execution through the Supabase SQL editor.

The implementation must preserve all existing working behaviour unless a specific change is listed below.

---

## 1. Permanent product rules and documentation

Create:

`JAANNEE_PRODUCT_[RULES.md](http://RULES.md)`

Document the permanent JaanNee rules:

- Rankings come only from signed-in diners.
- Restaurants cannot add dishes, vote, manage listings or influence rankings.
- Never show a numeric rank before a dish has at least 5 comparisons.
- Comparisons must occur only inside the same valid ranking pool.
- A ranking pool is:
  - category only when the category does not require sub-types;
  - category plus sub-type when sub-types are required.
- Cuisine is only a grouping label and must never affect ranking.
- Categories and sub-types are controlled by admins.
- Areas proposed through place submissions require admin approval.
- Broad categories must have admin-created sub-types before dishes can be approved.
- Users may compare only dishes they have marked as tried.
- Ranking position must never be sold, assigned or manually altered.
- Every schema change must be delivered as manual SQL.
- Lovable must never automatically apply migrations.
- Existing production data must never be reset or silently rewritten.

Add a short reference in `[AGENTS.md](http://AGENTS.md)` directing future agents to `JAANNEE_PRODUCT_[RULES.md](http://RULES.md)`.

Also add these rules to Lovable Project Knowledge.

---

## 2. Enforce tried-before-voting

### Server validation

Update `submitComparison`.

Before accepting an insert or update:

- Confirm the user is authenticated.
- Confirm both dishes exist.
- Confirm both dishes are approved.
- Confirm both dishes belong to the same valid ranking pool.
- Confirm the selected winner is one of the two dishes.
- Confirm the authenticated user has a `dish_tries` row for both dishes.
- Reject the request with a clear message when either dish has not been marked tried.

Do not rely only on the client interface.

### Database enforcement

Add a `BEFORE INSERT OR UPDATE` trigger on `public.comparisons`.

The trigger must:

- check that `NEW.user_id` has tried `[NEW.dish](http://NEW.dish)_lo_id`;
- check that `NEW.user_id` has tried `[NEW.dish](http://NEW.dish)_hi_id`;
- reject the comparison when either tried row is missing;
- raise a clear error such as:

`You must mark both dishes as tried before comparing them.`

The database trigger must work independently of the application.

### Compare interface

Update `/compare` so:

- signed-in users can select only dishes they have marked as tried;
- category and sub-type filtering remains enforced;
- signed-out users see an explanation and sign-in CTA;
- if fewer than two tried dishes exist in the selected ranking pool, show:
  - why comparison is unavailable;
  - a link to discover dishes;
  - instructions to mark dishes as tried;
- dishes must never be silently marked as tried;
- the existing inline comparison after marking dishes tried continues working.

---

## 3. Safe dish merge and deletion

### Safe merge function

Create:

`public.admin_merge_dishes(keep_id uuid, remove_id uuid)`

The function must be transactional and executable only by `service_role`.

It must:

- reject identical IDs;
- confirm both dishes exist;
- confirm both dishes belong to the same place;
- confirm both dishes belong to the same category;
- confirm both dishes belong to the same sub-type ranking pool;
- reject the merge if either dish has any comparison history;
- transfer `dish_tries` using conflict-safe upsert behaviour;
- transfer reports to the retained dish;
- delete the duplicate only after every validation and transfer succeeds;
- return a useful result;
- never recalculate or rewrite Elo.

Update `mergeDishAdmin` to call this RPC through `supabaseAdmin`.

Update the admin interface to state clearly:

- merging is allowed only when neither dish has comparisons;
- dishes with ranking history cannot currently be merged.

### Safe deletion

Prevent deletion of a dish when comparisons reference it.

Enforce this in:

- the admin server function;
- a database trigger or protected deletion function.

Allow deletion only when the dish has no comparison history.

Pending, rejected and approved zero-comparison dishes may still be deleted.

Return a clear admin-facing error rather than allowing cascade deletion of ranking history.

### Security hardening

Every new `SECURITY DEFINER` function must:

- use:
  `SET search_path = public, pg_temp`
- schema-qualify all referenced tables and functions;
- avoid dynamic SQL;
- revoke execution from:
  - `PUBLIC`
  - `anon`
  - `authenticated`
- grant execution only to `service_role`.

---

## 4. Secure photo uploads and proxy delivery

### Storage restrictions

Update the private `dish-photos` bucket:

- maximum file size: 8 MB;
- allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`

Do not allow:

- SVG;
- HTML;
- XML;
- GIF;
- PDF;
- arbitrary binary formats.

Keep the bucket private.

### Client validation

Apply validation in both:

- normal dish submission;
- admin photo upload.

Reject files that are:

- empty;
- larger than 8 MB;
- not JPEG, PNG or WebP.

Generate a safe filename using:

- a UUID or cryptographically safe identifier;
- an extension derived from the accepted MIME type.

Do not trust or reuse the original filename.

### Photo proxy

Update `/photos/$`.

The proxy must:

- serve only JPEG, PNG and WebP;
- reject unsupported stored content types with HTTP 415;
- return:
  `X-Content-Type-Options: nosniff`
- keep CORS support;
- keep suitable public cache headers;
- never serve active content from the JaanNee domain.

Do not make the storage bucket public.

---

## 5. Categories requiring sub-types

Add to `public.categories`:

`requires_subtype boolean not null default false`

This field must be admin-controlled.

### Approval and ranking enforcement

A dish must not be approved when:

- its category has `requires_subtype = true`;
- and it does not have a valid active sub-type belonging to that category.

Also treat a category as requiring a sub-type whenever it has any active sub-types, even if `requires_subtype` was accidentally left false.

Enforce this in:

- `moderateDish`;
- normal dish submission validation;
- bulk dish import;
- category-assignment admin flow;
- database triggers;
- comparison validation;
- leaderboard validation;
- MCP tools.

A category requiring sub-types must never:

- approve a dish without a valid active sub-type;
- accept comparisons without a specific sub-type pool;
- return a mixed category leaderboard;
- return an MCP leaderboard without a valid sub-type.

### Admin interface

Add a `Requires dish type` switch to:

- category creation;
- category editing.

In the taxonomy interface:

- display a badge for categories requiring sub-types;
- warn when such a category has no active sub-types;
- prevent accidental approval into an incomplete ranking pool.

### Initial sub-type reference data

Mark the following categories as requiring sub-types and create these active sub-types.

Use stable `display_order` values.

#### Sushi

- `nigiri` — Nigiri — นิกิริ
- `maki-roll` — Maki Roll — มากิโรล
- `temaki` — Temaki — เทมากิ
- `chirashi` — Chirashi — ชิราชิ

#### Dim Sum

- `har-gow` — Har Gow — ฮะเก๋า
- `siu-mai` — Siu Mai — ขนมจีบ
- `char-siu-bao` — Char Siu Bao — ซาลาเปาหมูแดง
- `xiao-long-bao` — Xiao Long Bao — เสี่ยวหลงเปา

#### Tapas

- `patatas-bravas` — Patatas Bravas — ปาตาตัสบราวาส
- `croquetas` — Croquetas — โครเกตัส
- `gambas-al-ajillo` — Gambas al Ajillo — กุ้งกระเทียมสเปน
- `tortilla-espanola` — Tortilla Española — ไข่เจียวสเปน

#### Korean BBQ

- `samgyeopsal` — Samgyeopsal — ซัมกยอบซัล
- `galbi` — Galbi — คัลบี
- `bulgogi` — Bulgogi — บุลโกกิ

#### Steak

- `ribeye` — Ribeye — ริบอาย
- `sirloin` — Sirloin — เซอร์ลอยน์
- `tenderloin` — Tenderloin — เทนเดอร์ลอยน์

#### Specialty Coffee

- `espresso` — Espresso — เอสเปรสโซ
- `flat-white` — Flat White — แฟลตไวท์
- `cappuccino` — Cappuccino — คาปูชิโน
- `pour-over` — Pour Over — กาแฟดริป
- `cold-brew` — Cold Brew — โคลด์บรูว์

#### Matcha

- `usucha` — Usucha — อุสุฉะ
- `matcha-latte` — Matcha Latte — มัทฉะลาเต้
- `matcha-tonic` — Matcha Tonic — มัทฉะโทนิก

Use conflict-safe inserts.

If an expected category slug does not exist:

- do not create an unrelated replacement category;
- log a clear SQL notice;
- continue safely.

The explicitly specified category flags and sub-type rows are intentional production reference-data changes.

Do not delete, reset or rewrite user-generated production data.

---

## 6. Fix MCP ranking-pool support

### `list_categories`

Return:

- category slug;
- English name;
- Thai name;
- cuisine information;
- `requires_subtype`;
- active sub-types including:
  - slug;
  - English name;
  - Thai name;
  - display order.

### `list_dishes`

Add optional:

`subtypeSlug`

Rules:

- a sub-type cannot be supplied without `categorySlug`;
- validate that the sub-type belongs to the category;
- when the category requires a sub-type or has active sub-types, reject requests missing `subtypeSlug`;
- filter results by the selected sub-type;
- never combine multiple sub-type pools.

Return ranking-pool metadata in `structuredContent`.

### `leaderboard`

Add the same `subtypeSlug` behaviour.

Continue requiring at least five comparisons.

The tool must never return a mixed leaderboard for a broad category.

Update:

- tool descriptions;
- schemas;
- connection documentation;
- `/connect` copy.

Add MCP tests covering:

- category without sub-types;
- category requiring a sub-type;
- missing required sub-type;
- invalid sub-type;
- sub-type belonging to another category;
- five-comparison threshold;
- prevention of mixed broad-category leaderboards.

---

## 7. Prevent database-level dish duplicates

Add a unique expression index based on:

- `place_id`;
- `lower(btrim(name_en))`.

Suggested name:

`dishes_place_name_ci`

### Conflict pre-check

Before creating the index:

- detect any existing conflicts;
- if conflicts exist, raise a readable `EXCEPTION`;
- stop the SQL script before index creation;
- list enough information to identify:
  - conflicting place IDs;
  - normalised dish names;
  - number of conflicting rows.

Do not merely raise a `NOTICE`.

Do not automatically delete, merge or rename conflicting dishes.

### Application handling

Map PostgreSQL error code `23505` for this index to a user-friendly possible-duplicate message in:

- normal dish submission;
- CSV dish import;
- relevant admin insertion flows.

Keep the existing similarity search as an early warning.

Do not rely on similarity search as the only protection.

`name_th` remains optional and is not part of the unique index. Document this limitation.

---

## 8. Remove provisional Elo from public discovery ordering

`tried_count` is calculated through `get_dish_tried_counts`; it is not stored directly on `dishes`.

Do not attempt to order unranked dishes by `tried_count` in the initial Supabase query.

For public discovery lists:

1. Fetch eligible approved dishes.
2. Retrieve tried counts through the existing restricted RPC.
3. Attach tried counts on the server.
4. Apply stable server-side ordering:

### Ranked segment

Dishes with:

`comparisons_count >= 5`

Order by:

1. Elo descending;
2. creation date descending as a stable tie-breaker.

### Unranked segment

Dishes with:

`comparisons_count < 5`

Order by:

1. tried count descending;
2. creation date descending.

Return ranked dishes first, followed by unranked dishes.

Do not:

- use provisional Elo to order unranked dishes;
- add a denormalised `tried_count` column;
- alter the formal leaderboard logic.

The formal leaderboard must continue excluding dishes below five comparisons.

---

## 9. Correct comparison and diner wording

Review all English and Thai text.

Do not describe `comparisons_count` as a number of diners.

Use wording such as:

- `5 comparisons`
- Thai equivalent for comparisons

Use diner wording only for `tried_count`.

Update:

- dish metrics;
- cards;
- profile pages;
- rankings;
- MCP descriptions where relevant;
- translation keys.

Do not change the underlying meaning of the data.

---

## 10. Improve nearby-place lookup

Create:

`public.nearby_places(lat, lng, radius_km, max_results default 20)`

The function must:

- consider only approved places;
- consider only places with coordinates;
- use a bounding-box prefilter;
- calculate exact distance using the Haversine formula;
- order by nearest distance;
- limit results;
- return the fields expected by the existing interface;
- avoid PostGIS unless already required elsewhere.

The function must use the `SECURITY DEFINER` hardening rules:

- `SET search_path = public, pg_temp`;
- schema-qualified object references;
- no dynamic SQL;
- revoke execution from `PUBLIC`, `anon` and `authenticated`;
- grant only to `service_role`.

Update the existing public server function to call this RPC through `supabaseAdmin`.

Preserve the current interface and returned field structure.

Do not load up to 1,000 place rows into application memory.

---

## 11. Manual SQL structure and reproducibility

Do not delete or rewrite historical migrations.

Create:

### `supabase/manual/[README.md](http://README.md)`

Document:

- all database changes are manual;
- Lovable must never automatically apply migrations;
- which SQL file is for the existing live database;
- which file is for new empty environments;
- exact execution order;
- verification procedure;
- rollback considerations;
- known limitations.

### `supabase/manual/000_current_schema_snapshot.sql`

Create a schema-only snapshot representing the complete intended database after this update.

Include:

- enums;
- public tables;
- columns;
- defaults;
- indexes;
- constraints;
- foreign keys;
- functions;
- triggers;
- RLS policies;
- grants;
- required storage bucket configuration;
- storage policies.

Header:

`FOR NEW EMPTY ENVIRONMENTS ONLY — DO NOT RUN ON THE EXISTING LIVE DATABASE`

Do not include:

- production rows;
- users;
- auth records;
- secrets;
- API keys.

### `supabase/manual/20260725_integrity_hardening.sql`

Create one manual SQL file containing every live-database change required by this update.

It must:

- be suitable for the existing live database;
- be idempotent where reasonably possible;
- use `IF EXISTS`, `IF NOT EXISTS` and guarded `DO` blocks;
- preserve current user-generated data;
- include comments;
- use transactions where safe;
- stop safely when duplicate dish conflicts prevent index creation;
- contain no secrets;
- not be applied automatically.

### `supabase/manual/VERIFY_20260725_integrity_hardening.sql`

Create read-only verification queries confirming:

- `categories.requires_subtype` exists;
- expected category flags exist;
- expected sub-types exist;
- tried-before-voting trigger exists;
- ranking-pool validation exists;
- categories requiring sub-types cannot approve dishes without valid sub-types;
- safe merge function exists;
- safe deletion protection exists;
- new security-definer functions have restricted grants;
- storage size and MIME restrictions exist;
- nearby-place function exists;
- duplicate-dish index exists;
- RLS remains enabled on all public tables;
- sensitive functions are not executable by `PUBLIC`, `anon` or `authenticated`;
- MCP-relevant ranking-pool data exists.

---

## 12. Automated tests and scripts

Add Vitest and an appropriate React testing setup.

Add package scripts:

- `typecheck`
- `test`
- `build`

Extract testable helpers where useful for:

- rank visibility;
- ranking-pool derivation;
- ranking-pool validation;
- file validation;
- public list ordering;
- comparison and diner wording;
- MCP sub-type validation.

Add tests covering at minimum:

1. Numeric rank hidden below five comparisons.
2. Numeric rank shown at five comparisons.
3. Category-only ranking pool.
4. Category plus sub-type ranking pool.
5. Cross-sub-type comparison rejection.
6. Category requiring a sub-type cannot approve a dish without one.
7. Category requiring a sub-type cannot compare without one.
8. Category requiring a sub-type cannot return a mixed leaderboard.
9. MCP leaderboard rejects missing required sub-type.
10. Comparison rejected when either dish is not marked tried.
11. Comparison updates still recalculate Elo correctly.
12. Merge rejected when either dish has comparison history.
13. Delete rejected when dish has comparison history.
14. Unsupported photo type rejected.
15. Empty photo rejected.
16. Photo larger than 8 MB rejected.
17. MCP invalid sub-type rejected.
18. MCP cross-category sub-type rejected.
19. Unranked public ordering ignores provisional Elo.
20. Unranked public ordering uses tried count then creation date.
21. Comparison count wording does not use diner wording.
22. Tried count continues using diner wording.
23. Duplicate database conflict is mapped to a friendly application error.

Database-only behaviour may be covered by the SQL verification file when a safe automated database test environment is unavailable.

Do not claim a database guard is tested solely because a TypeScript helper passes.

---

## 13. Preserve existing functionality

Do not break:

- magic-link authentication;
- Google authentication;
- public browsing;
- private storage architecture;
- public photo proxy;
- dish submission;
- pending moderation;
- place moderation;
- category grouping by cuisine;
- category and area CSV import/export;
- tried marks;
- profiles;
- follows;
- reports;
- public dish pages;
- Open Graph metadata;
- sitemap;
- mobile layout;
- current styling;
- authenticated MCP access;
- current Elo K-factor;
- current Elo formula;
- five-comparison threshold.

Do not add:

- restaurant dashboards;
- restaurant verification;
- restaurant-controlled listings;
- paid placement;
- paid ranking;
- reviews;
- star ratings;
- memberships;
- subscriptions;
- monetisation;
- unrelated redesigns.

---

## Acceptance criteria

The update is complete only when all of the following are verified:

- A user cannot compare two dishes unless both are marked tried.
- The database independently rejects invalid untried comparisons.
- Cross-category comparisons are impossible.
- Cross-sub-type comparisons are impossible.
- Categories requiring sub-types cannot approve dishes without a valid active sub-type.
- Categories requiring sub-types cannot return mixed leaderboards.
- MCP cannot return a leaderboard for a broad category without a valid sub-type.
- No numeric rank appears below five comparisons.
- Provisional Elo does not control unranked public discovery order.
- A dish with comparison history cannot be merged.
- A dish with comparison history cannot be deleted.
- Safe zero-comparison merging is transactional.
- Duplicate dish names at the same place are blocked by the database.
- Existing duplicate conflicts stop index creation with a readable exception.
- Uploads are restricted to JPEG, PNG and WebP.
- Uploads are limited to 8 MB.
- Empty uploads are rejected.
- The public proxy cannot serve active content.
- Nearby places are calculated through the database function.
- Comparison counts are not described as diner counts.
- Permanent product rules exist in Project Knowledge and repository documentation.
- All database changes are delivered as manual SQL.
- No SQL was automatically applied.
- No publishing occurred automatically.
- Typecheck passes.
- Tests pass.
- Production build passes.

---

## Out of scope

- No Elo recalculation during dish merge.
- No merging of dishes with comparison history.
- No PostGIS.
- No deletion, reset or rewriting of user-generated production data.
- The explicitly specified category flags and sub-type seed rows are intentional reference-data changes.
- No automatic SQL execution.
- No automatic publishing.
- No unrelated product or visual changes.

---

## Required final response from Lovable

At completion, report:

1. Summary of each issue fixed.
2. Every file changed.
3. Every file created.
4. Exact path of the SQL file for the existing live database.
5. Explicit confirmation that the SQL was not applied.
6. Exact path of the verification SQL file.
7. Manual actions required from the project owner.
8. Typecheck result.
9. Test result.
10. Production build result.
11. Any failed acceptance criterion.
12. Any remaining limitation.
13. Explicit confirmation that the project was not automatically published.

Do not claim completion unless every completed item has been verified.