create type payment_status as enum ('unpaid', 'processing', 'paid', 'refunded');
alter table public.jobs
  add column if not exists payment_status payment_status not null default 'unpaid',
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamp with time zone;
create index if not exists jobs_payment_status_idx on public.jobs(payment_status);
alter table public.jobs
  add constraint jobs_payment_method_check
  check (
    payment_method is null
    or payment_method in ('card', 'upi', 'cash')
  );
