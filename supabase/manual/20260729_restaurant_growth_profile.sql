-- JaanNee restaurant booking links, media, official updates, and Growth trial.
-- MANUAL EXECUTION ONLY. Run after 20260729_restaurant_monetization.sql.
begin;

alter table public.restaurant_profiles
  add column if not exists reservation_url text,
  add column if not exists logo_url text,
  add column if not exists cover_url text,
  add column if not exists subscription_tier text not null default 'free',
  add column if not exists subscription_status text not null default 'free',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'restaurant_profiles_subscription_tier_check'
      and conrelid = 'public.restaurant_profiles'::regclass
  ) then
    alter table public.restaurant_profiles
      add constraint restaurant_profiles_subscription_tier_check
      check (subscription_tier in ('free', 'growth'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'restaurant_profiles_subscription_status_check'
      and conrelid = 'public.restaurant_profiles'::regclass
  ) then
    alter table public.restaurant_profiles
      add constraint restaurant_profiles_subscription_status_check
      check (subscription_status in ('free', 'trialing', 'active', 'past_due', 'canceled'));
  end if;
end $$;

create table if not exists public.restaurant_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  photo_url text not null,
  caption text check (char_length(caption) <= 160),
  display_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists restaurant_gallery_place_order_idx
  on public.restaurant_gallery_photos(place_id, display_order, created_at);

create table if not exists public.restaurant_updates (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 100),
  body text not null check (char_length(btrim(body)) between 2 and 1000),
  photo_url text,
  cta_label text check (char_length(cta_label) <= 40),
  cta_url text,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > published_at)
);
create index if not exists restaurant_updates_public_idx
  on public.restaurant_updates(place_id, published_at desc)
  where is_active = true;

alter table public.restaurant_gallery_photos enable row level security;
alter table public.restaurant_updates enable row level security;

drop policy if exists "verified restaurant galleries are public" on public.restaurant_gallery_photos;
create policy "verified restaurant galleries are public"
  on public.restaurant_gallery_photos
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.restaurant_profiles rp
      where rp.place_id = restaurant_gallery_photos.place_id
        and rp.is_verified = true
    )
  );

drop policy if exists "active verified restaurant updates are public" on public.restaurant_updates;
create policy "active verified restaurant updates are public"
  on public.restaurant_updates
  for select to anon, authenticated
  using (
    is_active = true
    and published_at <= now()
    and (expires_at is null or expires_at > now())
    and exists (
      select 1 from public.restaurant_profiles rp
      where rp.place_id = restaurant_updates.place_id
        and rp.is_verified = true
    )
  );

create or replace function public.restaurant_growth_is_active(_place_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.restaurant_profiles rp
    where rp.place_id = _place_id
      and rp.is_verified = true
      and rp.subscription_tier = 'growth'
      and (
        rp.subscription_status = 'active'
        or (
          rp.subscription_status = 'trialing'
          and rp.trial_ends_at > now()
        )
      )
  );
$$;

-- Audience access is a paid Growth capability. Diners still retain full control
-- of their own consent row through the separate diner policy.
drop policy if exists "restaurant members read consented audience" on public.restaurant_contact_permissions;
create policy "restaurant members read consented audience"
  on public.restaurant_contact_permissions
  for select to authenticated
  using (
    public.restaurant_growth_is_active(place_id)
    and exists (
      select 1
      from public.restaurant_memberships m
      where m.place_id = restaurant_contact_permissions.place_id
        and m.user_id = auth.uid()
    )
  );

create or replace function public.guard_restaurant_growth_content()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.restaurant_memberships m
    where m.place_id = new.place_id and m.user_id = new.created_by
  ) then
    raise exception 'Verified restaurant access is required.';
  end if;
  if not public.restaurant_growth_is_active(new.place_id) then
    raise exception 'An active Growth plan or trial is required.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_restaurant_update_frequency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (
    select count(*)
    from public.restaurant_updates ru
    where ru.place_id = new.place_id
      and ru.published_at > now() - interval '7 days'
  ) >= 2 then
    raise exception 'Restaurants may publish up to two official updates every 7 days.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restaurant_gallery_growth_guard on public.restaurant_gallery_photos;
create trigger trg_restaurant_gallery_growth_guard
before insert or update on public.restaurant_gallery_photos
for each row execute function public.guard_restaurant_growth_content();

drop trigger if exists trg_restaurant_updates_growth_guard on public.restaurant_updates;
create trigger trg_restaurant_updates_growth_guard
before insert or update on public.restaurant_updates
for each row execute function public.guard_restaurant_growth_content();

drop trigger if exists trg_restaurant_updates_frequency on public.restaurant_updates;
create trigger trg_restaurant_updates_frequency
before insert on public.restaurant_updates
for each row execute function public.guard_restaurant_update_frequency();

create or replace function public.guard_restaurant_outreach_growth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.restaurant_growth_is_active(new.place_id) then
    raise exception 'An active Growth plan or trial is required.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restaurant_outreach_growth on public.restaurant_outreach;
create trigger trg_restaurant_outreach_growth
before insert on public.restaurant_outreach
for each row execute function public.guard_restaurant_outreach_growth();

revoke all on public.restaurant_gallery_photos, public.restaurant_updates from public;
grant select on public.restaurant_gallery_photos, public.restaurant_updates to anon, authenticated;
grant select, insert, update, delete on public.restaurant_gallery_photos, public.restaurant_updates to service_role;

revoke all on function public.restaurant_growth_is_active(uuid) from public, anon, authenticated;
revoke all on function public.guard_restaurant_growth_content() from public, anon, authenticated;
revoke all on function public.guard_restaurant_update_frequency() from public, anon, authenticated;
revoke all on function public.guard_restaurant_outreach_growth() from public, anon, authenticated;
grant execute on function public.restaurant_growth_is_active(uuid) to service_role;

commit;
