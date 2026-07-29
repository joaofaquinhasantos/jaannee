# Manual DB scripts

**Database changes for JaanNee are manual-only.** The Lovable migration
tool is not to be used against the live database as part of normal work.
The earlier direct migrations that produced files under
`supabase/migrations/2026072504*.sql` were an exception and must not be
repeated.

## Files

- `20260728_interest_follows.sql` — private, diner-owned category and area
  follows used to personalize Discover. Run
  `VERIFY_20260728_interest_follows.sql` afterward.

- `20260725_integrity_hardening.sql` — corrected final intended integrity
  state (safe merge, tried-on-every-update trigger, ranking-key,
  requires_subtype flag + seeds, whitespace-safe normaliser + index
  rebuild, `nearby_places` with bbox and caps, sensitive-function grants,
  storage bucket restrictions). Depends on the existing base JaanNee
  schema; this is **not** a fresh-environment snapshot.
- `VERIFY_20260725_integrity_hardening.sql` — read-only checks. Runs
  inside the Supabase SQL editor (no `\psql` commands). Every row should
  report `OK`.
- `20260727_atomic_immutable_comparisons.sql` — removes direct
  authenticated comparison writes, makes comparison history immutable,
  and installs the atomic comparison/Elo/count write path.
- `VERIFY_20260727_atomic_immutable_comparisons.sql` — read-only checks
  for privileges, immutability, atomic Elo application, and RPC access.
- `20260727_prelaunch_privacy_taxonomy.sql` — restricts public profile
  reads to claimed usernames, enforces approved-only tried marks, and
  protects established ranking pools from taxonomy shape changes.
- `VERIFY_20260727_prelaunch_privacy_taxonomy.sql` — read-only checks for
  those policies and triggers.
- `20260727_approved_photo_immutability.sql` — removes authenticated
  storage-object updates and allows owners to delete only photos that are not
  referenced by an approved dish.
- `VERIFY_20260727_approved_photo_immutability.sql` — read-only checks for
  the approved-photo storage policies.
- `20260727_category_reference_photos.sql` — adds the admin-managed visual
  reference photo field to categories.
- `VERIFY_20260727_category_reference_photos.sql` — read-only check for the
  category reference photo field.
- `20260727_atmospheric_category_photos.sql` — adds initial reference photos
  to Pad Kra Pao, Khao Soi, and Tom Yum only when their photo field is empty.
  Every image remains replaceable or removable in Admin > Taxonomy.
- `VERIFY_20260727_atmospheric_category_photos.sql` — read-only check for the
  three initial reference photos.
- `20260728_retention_foundation.sql` — adds the private, diner-owned
  `dish_wants` list and clears a saved dish automatically when it is marked
  tried. Saved dishes never influence rankings.
- `VERIFY_20260728_retention_foundation.sql` — read-only checks for the table,
  RLS, grants, policies, and tried-conversion trigger.
- `20260728_submitter_tried_on_approval.sql` — marks a dish as tried by its
  submitter when admin approval makes it comparison-eligible, and safely
  backfills existing approved submissions.
- `VERIFY_20260728_submitter_tried_on_approval.sql` — read-only checks for the
  approval trigger, restricted function grants, and missing tried marks.

## Execution order

1. Read `20260725_integrity_hardening.sql` end to end.
2. Paste it into the Supabase SQL editor and execute as one session
   (main transaction + trailing storage bucket update).
3. Paste `VERIFY_20260725_integrity_hardening.sql` into the SQL editor
   and confirm every row reports `OK`.
4. Paste `20260727_atomic_immutable_comparisons.sql` into the SQL editor
   and execute it as one transaction.
5. Paste `VERIFY_20260727_atomic_immutable_comparisons.sql` into the SQL
   editor and confirm every row reports `OK`.
6. Paste `20260727_prelaunch_privacy_taxonomy.sql` into the SQL editor.
7. Run `VERIFY_20260727_prelaunch_privacy_taxonomy.sql` and confirm every
   row reports `OK`.
8. Paste `20260727_approved_photo_immutability.sql` into the SQL editor.
9. Run `VERIFY_20260727_approved_photo_immutability.sql` and confirm every
   row reports `OK`.
10. Paste `20260727_category_reference_photos.sql` into the SQL editor.
11. Run `VERIFY_20260727_category_reference_photos.sql` and confirm the row
    reports `OK`.
12. Paste `20260727_atmospheric_category_photos.sql` into the SQL editor.
13. Run `VERIFY_20260727_atmospheric_category_photos.sql` and confirm all
    three rows report `OK`.
14. Paste `20260728_retention_foundation.sql` into the SQL editor.
15. Run `VERIFY_20260728_retention_foundation.sql` and confirm every row
    reports `OK`.
16. Paste `20260728_submitter_tried_on_approval.sql` into the SQL editor.
17. Run `VERIFY_20260728_submitter_tried_on_approval.sql` and confirm every
    row reports `OK`.
18. Paste `20260728_interest_follows.sql` into the SQL editor.
19. Run `VERIFY_20260728_interest_follows.sql` and confirm the tables, RLS,
    policies, and grants are present.
20. Paste `20260728_retention_suite.sql` into the SQL editor.
21. Run `VERIFY_20260728_retention_suite.sql` and confirm all five tables have
    RLS plus the expected owner-only policies and grants.
22. Paste `20260729_restaurant_monetization.sql` into the SQL editor.
23. Run `VERIFY_20260729_restaurant_monetization.sql` and confirm all five
    restaurant tables have RLS, the outreach guard exists, and the claim-review
    function is restricted to `service_role`.

Do not commit or execute either file automatically. Do not use the
Lovable migration tool for these changes.

## Fresh-environment note

These scripts assume the existing base JaanNee schema. A full
fresh-environment snapshot does not exist yet; do not claim these scripts
can rebuild a new database from scratch.
