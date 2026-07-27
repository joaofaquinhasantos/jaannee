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
- `20260727_atomic_immutable_comparisons.sql` — removes direct
  authenticated comparison writes, makes comparison history immutable,
  and installs the atomic comparison/Elo/count write path.
- `VERIFY_20260727_atomic_immutable_comparisons.sql` — read-only checks
  for privileges, immutability, atomic Elo application, and RPC access.

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

Do not commit or execute either file automatically. Do not use the
Lovable migration tool for these changes.

## Fresh-environment note

These scripts assume the existing base JaanNee schema. A full
fresh-environment snapshot does not exist yet; do not claim these scripts
can rebuild a new database from scratch.
