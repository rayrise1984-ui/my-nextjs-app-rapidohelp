alter table public.jobs
  add column if not exists company_fee_amount numeric(10,2),
  add column if not exists worker_payout_amount numeric(10,2);
alter table public.jobs
  add constraint jobs_company_fee_non_negative
  check (company_fee_amount is null or company_fee_amount >= 0);
alter table public.jobs
  add constraint jobs_worker_payout_non_negative
  check (worker_payout_amount is null or worker_payout_amount >= 0);
