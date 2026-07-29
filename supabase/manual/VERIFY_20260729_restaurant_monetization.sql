-- Read-only verification for 20260729_restaurant_monetization.sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'restaurant_claims', 'restaurant_memberships', 'restaurant_profiles',
  'restaurant_contact_permissions', 'restaurant_outreach'
) order by c.relname;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename like 'restaurant_%'
order by tablename, policyname;

select proname, prosecdef, proconfig, proacl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('guard_restaurant_outreach', 'admin_review_restaurant_claim');

select tgname, pg_get_triggerdef(oid)
from pg_trigger
where not tgisinternal and tgname = 'trg_restaurant_outreach_guard';
