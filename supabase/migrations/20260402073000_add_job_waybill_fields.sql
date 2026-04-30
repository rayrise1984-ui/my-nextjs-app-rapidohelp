alter table public.jobs
  add column if not exists waybill_number text,
  add column if not exists waybill_issued_at timestamp with time zone;
create or replace function public.set_job_waybill_fields()
returns trigger
language plpgsql
as $$
begin
  if new.waybill_number is null or btrim(new.waybill_number) = '' then
    new.waybill_number :=
      'WB-'
      || to_char(coalesce(new.created_at, now()), 'YYYYMMDD')
      || '-'
      || upper(substring(replace(new.id::text, '-', '') from 1 for 8));
  end if;

  if new.waybill_issued_at is null then
    new.waybill_issued_at := coalesce(new.created_at, now());
  end if;

  return new;
end;
$$;
drop trigger if exists jobs_waybill_fields_trigger on public.jobs;
create trigger jobs_waybill_fields_trigger
before insert on public.jobs
for each row
execute function public.set_job_waybill_fields();
update public.jobs
set
  waybill_number = coalesce(
    nullif(waybill_number, ''),
    'WB-'
    || to_char(coalesce(created_at, now()), 'YYYYMMDD')
    || '-'
    || upper(substring(replace(id::text, '-', '') from 1 for 8))
  ),
  waybill_issued_at = coalesce(waybill_issued_at, created_at, now())
where waybill_number is null
   or btrim(waybill_number) = ''
   or waybill_issued_at is null;
create unique index if not exists jobs_waybill_number_idx
  on public.jobs(waybill_number);
