# Manual DB scripts

Manual SQL kept alongside the app for reproducibility. The live database is
canonical; these scripts are how we rebuild it from scratch and how we
verify invariants.

## Files

- `20260725_integrity_hardening.sql` — cumulative integrity hardening
  (requires_subtype flag, approval-time sub-type enforcement, tried-before-
  voting trigger, delete guard, `admin_merge_dishes`, duplicate-name index,
  `nearby_places` RPC, `normalize_dish_name` helper).
- `verify_integrity.sql` — invariant checks. Run after any migration; every
  row should report `OK`.

## Applying

The Lovable migration tool applies changes to the live DB directly. The
SQL in `20260725_integrity_hardening.sql` mirrors what was executed via
that tool on 2026-07-25, so a fresh Supabase project can be brought to the
same state by running it once.

Storage bucket limits (MIME allowlist and 8MB size cap) are enforced in the
app layer (`src/routes/_authenticated/submit.tsx` and `src/routes/photos.$.ts`)
because the workspace's storage tooling does not currently expose those
bucket properties over the API.

## Verifying

```sh
psql "$SUPABASE_DB_URL" -f supabase/manual/verify_integrity.sql
```

Non-`OK` rows indicate an invariant regression — do not release.
