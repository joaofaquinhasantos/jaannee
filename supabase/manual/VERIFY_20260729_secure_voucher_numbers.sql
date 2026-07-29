-- Read-only verification for voucher security-number uniqueness.
select
  indexname,
  indexdef,
  case
    when indexdef ilike '%unique%'
      and indexdef ilike '%voucher_code%'
      and indexdef ilike '%kind = ''voucher''%'
    then 'OK'
    else 'CHECK'
  end as status
from pg_indexes
where schemaname = 'public'
  and tablename = 'restaurant_outreach'
  and indexname = 'restaurant_outreach_voucher_security_number_uidx';

select lower(btrim(voucher_code)) as duplicated_security_number, count(*) as occurrences
from public.restaurant_outreach
where kind = 'voucher' and voucher_code is not null
group by lower(btrim(voucher_code))
having count(*) > 1;

