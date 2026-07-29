-- JaanNee verified restaurant profiles, consented outreach, and gift vouchers.
-- MANUAL EXECUTION ONLY. Run after 20260728_retention_suite.sql.
begin;

create table if not exists public.restaurant_claims (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  business_role text not null check (char_length(btrim(business_role)) between 2 and 80),
  verification_note text not null check (char_length(btrim(verification_note)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists restaurant_claims_one_open_per_user_place
  on public.restaurant_claims(place_id, requested_by)
  where status in ('pending', 'approved');

create table if not exists public.restaurant_memberships (
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

create table if not exists public.restaurant_profiles (
  place_id uuid primary key references public.places(id) on delete cascade,
  is_verified boolean not null default false,
  official_description text check (char_length(official_description) <= 1000),
  menu_url text,
  line_url text,
  instagram_url text,
  phone text check (char_length(phone) <= 40),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_contact_permissions (
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_dish_id uuid not null references public.dishes(id) on delete cascade,
  allow_messages boolean not null default false,
  allow_vouchers boolean not null default false,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (place_id, user_id)
);

create table if not exists public.restaurant_outreach (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('message', 'voucher')),
  subject text not null check (char_length(btrim(subject)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  voucher_code text,
  voucher_terms text,
  expires_at timestamptz,
  read_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'message' and voucher_code is null and expires_at is null)
    or
    (kind = 'voucher' and char_length(btrim(voucher_code)) between 3 and 60 and expires_at > created_at)
  )
);
create index if not exists restaurant_outreach_recipient_created_idx
  on public.restaurant_outreach(recipient_user_id, created_at desc);
create index if not exists restaurant_outreach_place_created_idx
  on public.restaurant_outreach(place_id, created_at desc);

alter table public.restaurant_claims enable row level security;
alter table public.restaurant_memberships enable row level security;
alter table public.restaurant_profiles enable row level security;
alter table public.restaurant_contact_permissions enable row level security;
alter table public.restaurant_outreach enable row level security;

drop policy if exists "claimant reads own claims" on public.restaurant_claims;
create policy "claimant reads own claims" on public.restaurant_claims
  for select to authenticated using (requested_by = auth.uid());
drop policy if exists "claimant creates own claims" on public.restaurant_claims;
create policy "claimant creates own claims" on public.restaurant_claims
  for insert to authenticated with check (requested_by = auth.uid() and status = 'pending');

drop policy if exists "members read own memberships" on public.restaurant_memberships;
create policy "members read own memberships" on public.restaurant_memberships
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "verified restaurant profiles are public" on public.restaurant_profiles;
create policy "verified restaurant profiles are public" on public.restaurant_profiles
  for select to anon, authenticated using (is_verified = true);

drop policy if exists "diners manage own restaurant consent" on public.restaurant_contact_permissions;
create policy "diners manage own restaurant consent" on public.restaurant_contact_permissions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "restaurant members read consented audience" on public.restaurant_contact_permissions;
create policy "restaurant members read consented audience" on public.restaurant_contact_permissions
  for select to authenticated using (
    exists (
      select 1 from public.restaurant_memberships m
      where m.place_id = restaurant_contact_permissions.place_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "recipients read outreach" on public.restaurant_outreach;
create policy "recipients read outreach" on public.restaurant_outreach
  for select to authenticated using (recipient_user_id = auth.uid());
drop policy if exists "recipients update outreach state" on public.restaurant_outreach;
create policy "recipients update outreach state" on public.restaurant_outreach
  for update to authenticated using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());
drop policy if exists "restaurant members read sent outreach" on public.restaurant_outreach;
create policy "restaurant members read sent outreach" on public.restaurant_outreach
  for select to authenticated using (
    exists (
      select 1 from public.restaurant_memberships m
      where m.place_id = restaurant_outreach.place_id and m.user_id = auth.uid()
    )
  );

create or replace function public.guard_restaurant_outreach()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  permission_row public.restaurant_contact_permissions%rowtype;
begin
  if not exists (
    select 1 from public.restaurant_memberships m
    join public.restaurant_profiles rp on rp.place_id = m.place_id and rp.is_verified = true
    where m.place_id = new.place_id and m.user_id = new.sender_user_id
  ) then
    raise exception 'Verified restaurant access is required.';
  end if;

  select * into permission_row
  from public.restaurant_contact_permissions p
  where p.place_id = new.place_id
    and p.user_id = new.recipient_user_id
    and p.revoked_at is null;

  if not found
     or (new.kind = 'message' and not permission_row.allow_messages)
     or (new.kind = 'voucher' and not permission_row.allow_vouchers) then
    raise exception 'This diner has not permitted this outreach.';
  end if;

  if not exists (
    select 1
    from public.dishes d
    where d.place_id = new.place_id
      and d.status = 'approved'
      and (
        exists (select 1 from public.dish_tries dt where dt.dish_id = d.id and dt.user_id = new.recipient_user_id)
        or exists (select 1 from public.dish_wants dw where dw.dish_id = d.id and dw.user_id = new.recipient_user_id)
      )
  ) then
    raise exception 'The diner no longer has an eligible dish relationship.';
  end if;

  if new.kind = 'message' and exists (
    select 1 from public.restaurant_outreach o
    where o.place_id = new.place_id and o.recipient_user_id = new.recipient_user_id
      and o.kind = 'message' and o.created_at > now() - interval '7 days'
  ) then
    raise exception 'Only one restaurant message may be sent to this diner every 7 days.';
  end if;

  if new.kind = 'voucher' and exists (
    select 1 from public.restaurant_outreach o
    where o.place_id = new.place_id and o.recipient_user_id = new.recipient_user_id
      and o.kind = 'voucher' and o.created_at > now() - interval '30 days'
  ) then
    raise exception 'Only one gift voucher may be sent to this diner every 30 days.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restaurant_outreach_guard on public.restaurant_outreach;
create trigger trg_restaurant_outreach_guard
before insert on public.restaurant_outreach
for each row execute function public.guard_restaurant_outreach();

create or replace function public.admin_review_restaurant_claim(
  _claim_id uuid,
  _approve boolean,
  _reviewed_by uuid,
  _review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claim_row public.restaurant_claims%rowtype;
begin
  select * into claim_row from public.restaurant_claims where id = _claim_id for update;
  if not found then raise exception 'Restaurant claim not found.'; end if;
  if claim_row.status <> 'pending' then raise exception 'Restaurant claim has already been reviewed.'; end if;
  if not public.has_role(_reviewed_by, 'admin') then raise exception 'Administrator access required.'; end if;

  update public.restaurant_claims
  set status = case when _approve then 'approved' else 'rejected' end,
      reviewed_by = _reviewed_by,
      review_note = nullif(btrim(_review_note), ''),
      reviewed_at = now()
  where id = _claim_id;

  if _approve then
    insert into public.restaurant_memberships(place_id, user_id, role)
    values (claim_row.place_id, claim_row.requested_by, 'owner')
    on conflict (place_id, user_id) do update set role = 'owner';
    insert into public.restaurant_profiles(place_id, is_verified, updated_by)
    values (claim_row.place_id, true, claim_row.requested_by)
    on conflict (place_id) do update
      set is_verified = true, updated_by = excluded.updated_by, updated_at = now();
  end if;
  return jsonb_build_object('claim_id', _claim_id, 'approved', _approve, 'place_id', claim_row.place_id);
end;
$$;

revoke all on public.restaurant_claims, public.restaurant_memberships,
  public.restaurant_profiles, public.restaurant_contact_permissions,
  public.restaurant_outreach from public;
revoke all on function public.guard_restaurant_outreach() from public, anon, authenticated;
revoke all on function public.admin_review_restaurant_claim(uuid, boolean, uuid, text) from public, anon, authenticated;

grant select, insert on public.restaurant_claims to authenticated;
grant select on public.restaurant_memberships to authenticated;
grant select on public.restaurant_profiles to anon, authenticated;
grant select, insert, update, delete on public.restaurant_contact_permissions to authenticated;
grant select, update on public.restaurant_outreach to authenticated;
grant select, insert, update on public.restaurant_claims, public.restaurant_memberships,
  public.restaurant_profiles, public.restaurant_contact_permissions,
  public.restaurant_outreach to service_role;
grant execute on function public.admin_review_restaurant_claim(uuid, boolean, uuid, text) to service_role;

commit;
