-- JaanNee interest follows
-- Run manually in the Supabase SQL editor. Do not auto-apply.

begin;

create table if not exists public.category_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

create table if not exists public.area_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, area_id)
);

alter table public.category_follows enable row level security;
alter table public.area_follows enable row level security;

drop policy if exists "category follows owner read" on public.category_follows;
create policy "category follows owner read" on public.category_follows
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "category follows owner insert" on public.category_follows;
create policy "category follows owner insert" on public.category_follows
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "category follows owner delete" on public.category_follows;
create policy "category follows owner delete" on public.category_follows
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "area follows owner read" on public.area_follows;
create policy "area follows owner read" on public.area_follows
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "area follows owner insert" on public.area_follows;
create policy "area follows owner insert" on public.area_follows
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "area follows owner delete" on public.area_follows;
create policy "area follows owner delete" on public.area_follows
for delete to authenticated using (auth.uid() = user_id);

revoke all on table public.category_follows from public, anon;
revoke all on table public.area_follows from public, anon;
grant select, insert, delete on table public.category_follows to authenticated;
grant select, insert, delete on table public.area_follows to authenticated;

commit;
