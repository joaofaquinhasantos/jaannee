-- Read-only verification for 20260728_retention_foundation.sql.
-- Every row should report OK.

select
  'dish_wants table' as check_name,
  case when to_regclass('public.dish_wants') is not null then 'OK' else 'FAIL' end as result;

select
  'dish_wants RLS' as check_name,
  case when c.relrowsecurity then 'OK' else 'FAIL' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'dish_wants';

select
  'dish_wants owner policies' as check_name,
  case when count(*) = 3 then 'OK' else 'FAIL' end as result
from pg_policies
where schemaname = 'public'
  and tablename = 'dish_wants'
  and policyname in (
    'dish wants owner read',
    'dish wants owner insert approved',
    'dish wants owner delete'
  );

select
  'anonymous has no dish_wants privileges' as check_name,
  case when not has_table_privilege('anon', 'public.dish_wants', 'SELECT, INSERT, UPDATE, DELETE')
    then 'OK' else 'FAIL' end as result;

select
  'authenticated cannot update dish_wants' as check_name,
  case when not has_table_privilege('authenticated', 'public.dish_wants', 'UPDATE')
    then 'OK' else 'FAIL' end as result;

select
  'tried conversion trigger' as check_name,
  case when exists (
    select 1
    from pg_trigger
    where tgname = 'trg_clear_dish_want_after_try'
      and not tgisinternal
  ) then 'OK' else 'FAIL' end as result;

select
  'trigger function not callable by diners' as check_name,
  case when
    not has_function_privilege('public', 'public.clear_dish_want_after_try()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.clear_dish_want_after_try()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.clear_dish_want_after_try()', 'EXECUTE')
  then 'OK' else 'FAIL' end as result;
