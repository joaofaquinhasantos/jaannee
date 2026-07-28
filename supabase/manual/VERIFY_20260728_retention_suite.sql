-- Read-only verification for 20260728_retention_suite.sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'user_notifications', 'challenge_responses', 'user_retention_preferences',
  'dish_collections', 'dish_collection_items'
) order by c.relname;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in (
  'user_notifications', 'challenge_responses', 'user_retention_preferences',
  'dish_collections', 'dish_collection_items'
) order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in (
  'user_notifications', 'challenge_responses', 'user_retention_preferences',
  'dish_collections', 'dish_collection_items'
) order by table_name, grantee, privilege_type;
