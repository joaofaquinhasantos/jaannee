# Manual DB scripts

**Database changes for JaanNee are manual-only.** The Lovable migration
tool is not to be used against the live database as part of normal work.
The earlier direct migrations that produced files under
`supabase/migrations/2026072504*.sql` were an exception and must not be
repeated.

## Files

- `20260725_integrity_hardening.sql` — corrected final intended integrity
  state (safe merge, tried-on-every-update trigger, ranking-key,
  requires_subtype flag + seeds, whitespace-safe normaliser + index
  rebuild, `nearby_places` with bbox and caps, sensitive-function grants,
  storage bucket restrictions). Depends on the existing base JaanNee
  schema; this is **not** a fresh-environment snapshot.
- `VERIFY_20260725_integrity_hardening.sql` — read-only checks. Runs
  inside the Supabase SQL editor (no `\psql` commands). Every row should
  report `OK`.

## Execution order

1. Read `20260725_integrity_hardening.sql` end to end.
2. Paste it into the Supabase SQL editor and execute as one session
   (main transaction + trailing storage bucket update).
3. Paste `VERIFY_20260725_integrity_hardening.sql` into the SQL editor
   and confirm every row reports `OK`.

Do not commit or execute either file automatically. Do not use the
Lovable migration tool for these changes.

## Fresh-environment note

These scripts assume the existing base JaanNee schema. A full
fresh-environment snapshot does not exist yet; do not claim these scripts
can rebuild a new database from scratch.
