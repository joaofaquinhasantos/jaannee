-- Read-only verification for restaurant Growth profile additions.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'restaurant_profiles'
  and column_name in (
    'reservation_url', 'logo_url', 'cover_url', 'subscription_tier',
    'subscription_status', 'trial_started_at', 'trial_ends_at'
  )
order by column_name;

select relname, relrowsecurity
from pg_class
where oid in (
  'public.restaurant_gallery_photos'::regclass,
  'public.restaurant_updates'::regclass
);

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'restaurant_contact_permissions',
    'restaurant_gallery_photos',
    'restaurant_updates'
  )
order by tablename, policyname;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'restaurant_growth_is_active',
    'guard_restaurant_growth_content',
    'guard_restaurant_update_frequency',
    'guard_restaurant_outreach_growth'
  )
order by routine_name;

select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'trg_restaurant_gallery_growth_guard',
    'trg_restaurant_updates_growth_guard',
    'trg_restaurant_updates_frequency',
    'trg_restaurant_outreach_growth'
  )
order by trigger_name, event_manipulation;
