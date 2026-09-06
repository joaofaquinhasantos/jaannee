-- JaanNee Phase 1 — staging / provenance / validation (DRAFT)
-- Manual execution only. Do NOT apply through Lovable migrations.
-- Do NOT execute until owner (Johny) greenlights.
--
-- Scope: ADDITIVE ops/staging tables only.
-- Hard rules (JAANNEE_PRODUCT_RULES.md):
--   * Do not alter live Elo / comparisons / apply_elo / submit_comparison_atomic.
--   * staging_dishes must NEVER gain elo, comparisons_count, votes, or rank columns.
--   * Future publish path must upsert live dishes with elo=default (1000) and
--     comparisons_count=0 only — never INSERT into comparisons, never call apply_elo.
-- Phase 1b live additive columns and publish RPCs are OUT OF SCOPE for this script.

begin;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.pipeline_status as enum (
    'raw',
    'normalized',
    'deduped',
    'classified',
    'staged',
    'validated',
    'published',
    'rejected',
    'needs_review'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.confidence_tier as enum (
    'low',
    'medium',
    'high',
    'verified'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.entity_kind as enum (
    'place',
    'dish'
  );
exception when duplicate_object then null;
end $$;

-- Data & Supply design values (phase1-staging-schema.md)
do $$ begin
  create type public.source_type as enum (
    'google_maps',
    'website_menu',
    'delivery_app',
    'manual_csv',
    'diner_submit',
    'other'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- data_sources
-- ---------------------------------------------------------------------------
create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  source_type public.source_type not null,
  name text not null,
  base_url text,
  license_notes text not null default '',
  reliability_score numeric(3,2) not null default 0.50
    check (reliability_score >= 0 and reliability_score <= 1),
  created_at timestamptz not null default now()
);

create unique index if not exists data_sources_source_type_name_uidx
  on public.data_sources (source_type, name);

-- ---------------------------------------------------------------------------
-- import_cycles
-- ---------------------------------------------------------------------------
create table if not exists public.import_cycles (
  id uuid primary key default gen_random_uuid(),
  zone_slug text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  operator_notes text,
  discovered_places integer not null default 0 check (discovered_places >= 0),
  discovered_dishes integer not null default 0 check (discovered_dishes >= 0),
  staged integer not null default 0 check (staged >= 0),
  validated integer not null default 0 check (validated >= 0),
  published integer not null default 0 check (published >= 0),
  rejected integer not null default 0 check (rejected >= 0),
  validation_summary jsonb not null default '{}'::jsonb
);

create index if not exists import_cycles_zone_slug_idx
  on public.import_cycles (zone_slug, started_at desc);

-- ---------------------------------------------------------------------------
-- entity_provenance
-- ---------------------------------------------------------------------------
create table if not exists public.entity_provenance (
  id uuid primary key default gen_random_uuid(),
  entity_kind public.entity_kind not null,
  staging_id uuid not null,
  live_id uuid,
  data_source_id uuid not null references public.data_sources(id),
  source_record_id text not null,
  source_url text,
  captured_at timestamptz not null default now(),
  raw_payload jsonb,
  raw_storage_path text,
  extractor_version text not null default 'v0',
  confidence numeric(3,2) not null default 0.50
    check (confidence >= 0 and confidence <= 1),
  confidence_tier public.confidence_tier not null default 'low',
  created_at timestamptz not null default now()
);

create unique index if not exists entity_provenance_source_uidx
  on public.entity_provenance (entity_kind, data_source_id, source_record_id);

create index if not exists entity_provenance_staging_idx
  on public.entity_provenance (entity_kind, staging_id);

create index if not exists entity_provenance_live_idx
  on public.entity_provenance (entity_kind, live_id)
  where live_id is not null;

-- ---------------------------------------------------------------------------
-- staging_places
-- ---------------------------------------------------------------------------
create table if not exists public.staging_places (
  id uuid primary key default gen_random_uuid(),
  import_cycle_id uuid not null references public.import_cycles(id),
  name_en text,
  name_th text,
  name_normalized text,
  address_en text,
  address_th text,
  district text,
  subdistrict text,
  postal_code text,
  area_slug text,
  lat double precision,
  lng double precision,
  google_maps_url text,
  google_place_id text,
  cuisine_tags text[] not null default '{}',
  price_level integer check (price_level is null or price_level between 1 and 4),
  phone text,
  website text,
  line_id text,
  facebook_url text,
  instagram_url text,
  hours jsonb,
  pipeline_status public.pipeline_status not null default 'raw',
  confidence numeric(3,2) not null default 0.50
    check (confidence >= 0 and confidence <= 1),
  confidence_tier public.confidence_tier not null default 'low',
  duplicate_group_id uuid,
  canonical_staging_id uuid,
  live_place_id uuid references public.places(id),
  active boolean not null default true,
  last_verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staging_places_name_present
    check (coalesce(nullif(btrim(name_en), ''), nullif(btrim(name_th), '')) is not null)
);

create index if not exists staging_places_cycle_idx
  on public.staging_places (import_cycle_id);

create index if not exists staging_places_pipeline_idx
  on public.staging_places (pipeline_status);

create index if not exists staging_places_area_slug_idx
  on public.staging_places (area_slug);

create index if not exists staging_places_normalized_idx
  on public.staging_places (name_normalized);

create index if not exists staging_places_duplicate_group_idx
  on public.staging_places (duplicate_group_id)
  where duplicate_group_id is not null;

create index if not exists staging_places_live_place_idx
  on public.staging_places (live_place_id)
  where live_place_id is not null;

-- ---------------------------------------------------------------------------
-- staging_dishes
-- FORBIDDEN: elo, comparisons_count, votes, rank, or any ranking columns.
-- ---------------------------------------------------------------------------
create table if not exists public.staging_dishes (
  id uuid primary key default gen_random_uuid(),
  import_cycle_id uuid not null references public.import_cycles(id),
  staging_place_id uuid not null references public.staging_places(id),
  name_en text,
  name_th text,
  name_normalized text,
  category_slug text,
  subtype_slug text,
  menu_section text,
  description text,
  ingredients text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  price_thb numeric(12,2) check (price_thb is null or price_thb >= 0),
  currency text not null default 'THB',
  source_menu_url text,
  photo_url text,
  pipeline_status public.pipeline_status not null default 'raw',
  confidence numeric(3,2) not null default 0.50
    check (confidence >= 0 and confidence <= 1),
  confidence_tier public.confidence_tier not null default 'low',
  duplicate_group_id uuid,
  canonical_staging_id uuid,
  live_dish_id uuid references public.dishes(id),
  active boolean not null default true,
  last_verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staging_dishes_name_present
    check (coalesce(nullif(btrim(name_en), ''), nullif(btrim(name_th), '')) is not null)
);

create index if not exists staging_dishes_cycle_idx
  on public.staging_dishes (import_cycle_id);

create index if not exists staging_dishes_place_idx
  on public.staging_dishes (staging_place_id);

create index if not exists staging_dishes_pipeline_idx
  on public.staging_dishes (pipeline_status);

create index if not exists staging_dishes_category_slug_idx
  on public.staging_dishes (category_slug);

create index if not exists staging_dishes_normalized_idx
  on public.staging_dishes (name_normalized);

create index if not exists staging_dishes_duplicate_group_idx
  on public.staging_dishes (duplicate_group_id)
  where duplicate_group_id is not null;

create index if not exists staging_dishes_live_dish_idx
  on public.staging_dishes (live_dish_id)
  where live_dish_id is not null;

-- ---------------------------------------------------------------------------
-- staging_validation_results
-- ---------------------------------------------------------------------------
create table if not exists public.staging_validation_results (
  id uuid primary key default gen_random_uuid(),
  import_cycle_id uuid not null references public.import_cycles(id),
  entity_kind public.entity_kind not null,
  staging_id uuid not null,
  check_code text not null,
  severity text not null check (severity in ('error', 'warn')),
  message text not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists staging_validation_results_cycle_idx
  on public.staging_validation_results (import_cycle_id);

create index if not exists staging_validation_results_entity_idx
  on public.staging_validation_results (entity_kind, staging_id);

create index if not exists staging_validation_results_open_errors_idx
  on public.staging_validation_results (entity_kind, staging_id)
  where severity = 'error' and passed = false;

-- ---------------------------------------------------------------------------
-- updated_at touch for staging rows (ops only; does not touch live dishes/places)
-- ---------------------------------------------------------------------------
create or replace function public.touch_staging_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_staging_updated_at() from public, anon, authenticated;
grant execute on function public.touch_staging_updated_at() to service_role;

drop trigger if exists trg_staging_places_updated_at on public.staging_places;
create trigger trg_staging_places_updated_at
before update on public.staging_places
for each row
execute function public.touch_staging_updated_at();

drop trigger if exists trg_staging_dishes_updated_at on public.staging_dishes;
create trigger trg_staging_dishes_updated_at
before update on public.staging_dishes
for each row
execute function public.touch_staging_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: ops/staging tables are service_role only (no diner/anon access)
-- ---------------------------------------------------------------------------
alter table public.data_sources enable row level security;
alter table public.import_cycles enable row level security;
alter table public.entity_provenance enable row level security;
alter table public.staging_places enable row level security;
alter table public.staging_dishes enable row level security;
alter table public.staging_validation_results enable row level security;

revoke all on table public.data_sources from public, anon, authenticated;
revoke all on table public.import_cycles from public, anon, authenticated;
revoke all on table public.entity_provenance from public, anon, authenticated;
revoke all on table public.staging_places from public, anon, authenticated;
revoke all on table public.staging_dishes from public, anon, authenticated;
revoke all on table public.staging_validation_results from public, anon, authenticated;

grant all on table public.data_sources to service_role;
grant all on table public.import_cycles to service_role;
grant all on table public.entity_provenance to service_role;
grant all on table public.staging_places to service_role;
grant all on table public.staging_dishes to service_role;
grant all on table public.staging_validation_results to service_role;

commit;

-- ---------------------------------------------------------------------------
-- FUTURE (not in this draft — document only):
-- publish_staging_place / publish_staging_dish must require:
--   pipeline_status = 'validated'
--   confidence_tier in ('medium','high','verified')
--   zero open error rows in staging_validation_results
-- then upsert live places/dishes with comparisons_count=0 and default elo only.
-- Never insert comparisons. Never call apply_elo.
-- ---------------------------------------------------------------------------