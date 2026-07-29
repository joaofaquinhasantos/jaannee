-- JaanNee unique voucher security numbers.
-- MANUAL EXECUTION ONLY. Run after 20260729_restaurant_monetization.sql.
begin;

do $$
begin
  if exists (
    select 1
    from public.restaurant_outreach
    where kind = 'voucher'
      and voucher_code is not null
    group by lower(btrim(voucher_code))
    having count(*) > 1
  ) then
    raise exception 'Duplicate voucher security numbers exist. Resolve them before applying the unique index.';
  end if;
end $$;

create unique index if not exists restaurant_outreach_voucher_security_number_uidx
  on public.restaurant_outreach(lower(btrim(voucher_code)))
  where kind = 'voucher' and voucher_code is not null;

commit;

