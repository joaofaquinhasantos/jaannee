-- Read-only verification for 20260906_phase1_staging.sql
-- Every row should report OK. Do not mutate data.
-- Owner greenlit companion apply 2026-09-06.


-- Enums
select 'enum pipeline_status' as check_name,
  case when exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'pipeline_status'
  ) then 'OK' else 'FAIL' end as result;

select 'enum confidence_tier' as check_name,
  case when exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'confidence_tier'
  ) then 'OK' else 'FAIL' end as result;

select 'enum entity_kind' as check_name,
  case when exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'entity_kind'
  ) then 'OK' else 'FAIL' end as result;

select 'enum source_type' as check_name,
  case when exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'source_type'
  ) then 'OK' else 'FAIL' end as result;

select 'source_type labels' as check_name,
  case when (
    select array_agg(e.enumlabel order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'source_type'
  ) = array['google_maps','website_menu','delivery_app','manual_csv','diner_submit','other']::text[]
  then 'OK' else 'FAIL' end as result;

select 'pipeline_status labels' as check_name,
  case when (
    select array_agg(e.enumlabel order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'pipeline_status'
  ) = array['raw','normalized','deduped','classified','staged','validated','published','rejected','needs_review']::text[]
  then 'OK' else 'FAIL' end as result;

-- Tables present
select 'table data_sources' as check_name,
  case when to_regclass('public.data_sources') is not null then 'OK' else 'FAIL' end as result;

select 'table import_cycles' as check_name,
  case when to_regclass('public.import_cycles') is not null then 'OK' else 'FAIL' end as result;

select 'table entity_provenance' as check_name,
  case when to_regclass('public.entity_provenance') is not null then 'OK' else 'FAIL' end as result;

select 'table staging_places' as check_name,
  case when to_regclass('public.staging_places') is not null then 'OK' else 'FAIL' end as result;

select 'table staging_dishes' as check_name,
  case when to_regclass('public.staging_dishes') is not null then 'OK' else 'FAIL' end as result;

select 'table staging_validation_results' as check_name,
  case when to_regclass('public.staging_validation_results') is not null then 'OK' else 'FAIL' end as result;

-- staging_dishes must NOT have ranking columns
select 'staging_dishes has no elo column' as check_name,
  case when not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staging_dishes' and column_name = 'elo'
  ) then 'OK' else 'FAIL' end as result;

select 'staging_dishes has no comparisons_count' as check_name,
  case when not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staging_dishes'
      and column_name = 'comparisons_count'
  ) then 'OK' else 'FAIL' end as result;

select 'staging_dishes has no vote/rank columns' as check_name,
  case when not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staging_dishes'
      and column_name in ('votes','vote_count','rank','ranking','elo_score')
  ) then 'OK' else 'FAIL' end as result;

-- Required staging_dishes columns present
select 'staging_dishes core columns' as check_name,
  case when (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'staging_dishes'
      and column_name in (
        'id','import_cycle_id','staging_place_id','name_en','name_th','name_normalized',
        'category_slug','subtype_slug','pipeline_status','confidence','confidence_tier',
        'live_dish_id','active'
      )
  ) = 13 then 'OK' else 'FAIL' end as result;

select 'staging_places core columns' as check_name,
  case when (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'staging_places'
      and column_name in (
        'id','import_cycle_id','name_en','name_th','name_normalized','area_slug',
        'lat','lng','pipeline_status','confidence','confidence_tier','live_place_id','active'
      )
  ) = 13 then 'OK' else 'FAIL' end as result;

-- Provenance uniqueness
select 'entity_provenance unique source key' as check_name,
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'entity_provenance'
      and indexname = 'entity_provenance_source_uidx'
  ) then 'OK' else 'FAIL' end as result;

-- RLS enabled
select 'RLS data_sources' as check_name,
  case when c.relrowsecurity then 'OK' else 'FAIL' end as result
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'data_sources';

select 'RLS import_cycles' as check_name,
  case when c.relrowsecurity then 'OK' else 'FAIL' end as result
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'import_cycles';

select 'RLS entity_provenance' as check_name,
  case when c.relrowsecurity then 'OK' else 'FAIL' end as result
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'entity_provenance';

select 'RLS staging_places' as check_name,
  case when c.relrowsecurity then 'OK' else 'FAIL' end as result
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'staging_places';

select 'RLS staging_dishes' as check_name,
  case when c.relrowsecurity then 'OK' else 'FAIL' end as result
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'staging_dishes';

select 'RLS staging_validation_results' as check_name,
  case when c.relrowsecurity then 'OK' else 'FAIL' end as result
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'staging_validation_results';

-- Anon/authenticated must not have table privileges on staging/ops
select 'anon blocked on staging_dishes' as check_name,
  case when not has_table_privilege('anon', 'public.staging_dishes', 'SELECT, INSERT, UPDATE, DELETE')
    then 'OK' else 'FAIL' end as result;

select 'authenticated blocked on staging_dishes' as check_name,
  case when not has_table_privilege('authenticated', 'public.staging_dishes', 'SELECT, INSERT, UPDATE, DELETE')
    then 'OK' else 'FAIL' end as result;

select 'anon blocked on staging_places' as check_name,
  case when not has_table_privilege('anon', 'public.staging_places', 'SELECT, INSERT, UPDATE, DELETE')
    then 'OK' else 'FAIL' end as result;

select 'authenticated blocked on staging_places' as check_name,
  case when not has_table_privilege('authenticated', 'public.staging_places', 'SELECT, INSERT, UPDATE, DELETE')
    then 'OK' else 'FAIL' end as result;

-- Live ranking surface untouched (existence / grants sanity)
select 'live dishes.elo still present' as check_name,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dishes' and column_name = 'elo'
  ) then 'OK' else 'FAIL' end as result;

select 'live dishes.comparisons_count still present' as check_name,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dishes'
      and column_name = 'comparisons_count'
  ) then 'OK' else 'FAIL' end as result;

select 'apply_elo function still present' as check_name,
  case when to_regprocedure('public.apply_elo(uuid,uuid,uuid,uuid,boolean)') is not null
    then 'OK' else 'FAIL' end as result;

select 'comparisons table still present' as check_name,
  case when to_regclass('public.comparisons') is not null then 'OK' else 'FAIL' end as result;

-- No publish RPC slipped into this draft (Phase 1 publish is later)
select 'no publish_staging_dish in this draft' as check_name,
  case when to_regprocedure('public.publish_staging_dish(uuid)') is null
    then 'OK' else 'FAIL' end as result;

select 'no publish_staging_place in this draft' as check_name,
  case when to_regprocedure('public.publish_staging_place(uuid)') is null
    then 'OK' else 'FAIL' end as result;

-- Validation severity constraint
select 'validation severity check exists' as check_name,
  case when exists (
    select 1 from pg_constraint
    where conrelid = 'public.staging_validation_results'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%error%warn%'
  ) then 'OK' else 'FAIL' end as result;
