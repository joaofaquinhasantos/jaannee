-- JaanNee retention foundation
-- Manual execution only. Do not apply through Lovable migrations.
-- Adds a private "Want to try" list. It never affects tried counts,
-- comparisons, Elo, ranking pools, or public rank.

begin;

create table if not exists public.dish_wants (
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dish_id)
);

create index if not exists dish_wants_dish_id_idx
  on public.dish_wants (dish_id);

alter table public.dish_wants enable row level security;

revoke all on table public.dish_wants from public, anon;
revoke all on table public.dish_wants from authenticated;
grant select, insert, delete on table public.dish_wants to authenticated;
grant all on table public.dish_wants to service_role;

drop policy if exists "dish wants owner read" on public.dish_wants;
create policy "dish wants owner read"
  on public.dish_wants
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dish wants owner insert approved" on public.dish_wants;
create policy "dish wants owner insert approved"
  on public.dish_wants
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.dishes d
      where d.id = dish_id
        and d.status = 'approved'
    )
  );

drop policy if exists "dish wants owner delete" on public.dish_wants;
create policy "dish wants owner delete"
  on public.dish_wants
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.clear_dish_want_after_try()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.dish_wants
  where user_id = new.user_id
    and dish_id = new.dish_id;
  return new;
end;
$$;

revoke all on function public.clear_dish_want_after_try() from public, anon, authenticated;
grant execute on function public.clear_dish_want_after_try() to service_role;

drop trigger if exists trg_clear_dish_want_after_try on public.dish_tries;
create trigger trg_clear_dish_want_after_try
after insert on public.dish_tries
for each row
execute function public.clear_dish_want_after_try();

commit;
