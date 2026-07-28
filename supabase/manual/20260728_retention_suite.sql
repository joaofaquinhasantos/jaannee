-- JaanNee retention suite. MANUAL EXECUTION ONLY.
-- Run after 20260728_interest_follows.sql.
begin;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('challenge_response', 'dish_ranked', 'dish_approved', 'weekly_recap')),
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_created_idx
  on public.user_notifications(user_id, created_at desc);

create table if not exists public.challenge_responses (
  id uuid primary key default gen_random_uuid(),
  challenger_user_id uuid not null references auth.users(id) on delete cascade,
  responder_user_id uuid not null references auth.users(id) on delete cascade,
  dish_lo_id uuid not null references public.dishes(id) on delete cascade,
  dish_hi_id uuid not null references public.dishes(id) on delete cascade,
  winner_id uuid not null references public.dishes(id) on delete cascade,
  agreed boolean,
  created_at timestamptz not null default now(),
  check (challenger_user_id <> responder_user_id),
  check (dish_lo_id < dish_hi_id),
  check (winner_id in (dish_lo_id, dish_hi_id)),
  unique (challenger_user_id, responder_user_id, dish_lo_id, dish_hi_id)
);

create table if not exists public.user_retention_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_digest boolean not null default true,
  challenge_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.dish_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null default 'custom' check (kind in ('custom', 'weekend')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.dish_collection_items (
  collection_id uuid not null references public.dish_collections(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, dish_id)
);

alter table public.user_notifications enable row level security;
alter table public.challenge_responses enable row level security;
alter table public.user_retention_preferences enable row level security;
alter table public.dish_collections enable row level security;
alter table public.dish_collection_items enable row level security;

drop policy if exists "notifications owner read" on public.user_notifications;
create policy "notifications owner read" on public.user_notifications
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "notifications owner update" on public.user_notifications;
create policy "notifications owner update" on public.user_notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "challenge participants read" on public.challenge_responses;
create policy "challenge participants read" on public.challenge_responses
  for select to authenticated using (auth.uid() in (challenger_user_id, responder_user_id));
drop policy if exists "preferences owner all" on public.user_retention_preferences;
create policy "preferences owner all" on public.user_retention_preferences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "collections owner all" on public.dish_collections;
create policy "collections owner all" on public.dish_collections
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "collection items owner all" on public.dish_collection_items;
create policy "collection items owner all" on public.dish_collection_items
  for all to authenticated
  using (exists (select 1 from public.dish_collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.dish_collections c where c.id = collection_id and c.user_id = auth.uid()));

revoke all on public.user_notifications, public.challenge_responses,
  public.user_retention_preferences, public.dish_collections,
  public.dish_collection_items from public, anon;
grant select, update on public.user_notifications to authenticated;
grant select on public.challenge_responses to authenticated;
grant select, insert, update, delete on public.user_retention_preferences,
  public.dish_collections, public.dish_collection_items to authenticated;
grant select, insert, update on public.user_notifications to service_role;
grant select, insert, update on public.challenge_responses to service_role;

commit;
