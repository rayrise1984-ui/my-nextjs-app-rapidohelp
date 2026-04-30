create or replace function public.calculate_marketplace_payout(
  p_amount numeric,
  out company_fee_amount numeric,
  out worker_payout_amount numeric
)
returns record
language plpgsql
immutable
set search_path = public
as $$
declare
  rounded_amount numeric(10, 2);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  rounded_amount = round(p_amount, 2);
  company_fee_amount = round(rounded_amount * 0.20, 2);
  worker_payout_amount = round(rounded_amount - company_fee_amount, 2);
end;
$$;

create or replace function public.prepare_job_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is not null then
    new.user_id = current_user_id;
  elsif new.user_id is null then
    raise exception 'Job owner is required';
  end if;

  new.worker_id = null;
  new.status = 'pending';
  new.final_price = null;
  new.payment_status = 'unpaid';
  new.payment_method = null;
  new.payment_reference = null;
  new.paid_at = null;
  new.company_fee_amount = null;
  new.worker_payout_amount = null;
  new.accepted_at = null;
  new.completed_at = null;

  return new;
end;
$$;

drop trigger if exists set_job_owner on public.jobs;
drop trigger if exists prepare_job_insert on public.jobs;

create trigger prepare_job_insert
before insert on public.jobs
for each row execute procedure public.prepare_job_insert();

create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is not null and not public.has_staff_access(current_user_id) then
    new.role = old.role;
    new.is_worker = old.is_worker;
    new.worker_rating_avg = old.worker_rating_avg;
    new.worker_rating_count = old.worker_rating_count;
    new.total_earnings = old.total_earnings;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_sensitive_fields on public.profiles;

create trigger protect_profile_sensitive_fields
before update on public.profiles
for each row execute procedure public.protect_profile_sensitive_fields();

do $$
begin
  alter table public.jobs
    add constraint jobs_estimated_price_positive
    check (estimated_price is null or estimated_price > 0);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.jobs
    add constraint jobs_final_price_positive
    check (final_price is null or final_price > 0);
exception when duplicate_object then
  null;
end $$;

create or replace function public.accept_job(p_job_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_job public.jobs%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = current_user_id
      and is_worker = true
      and worker_profile_completed = true
  ) then
    raise exception 'Only workers with completed profiles can accept jobs' using errcode = '42501';
  end if;

  update public.jobs
  set
    worker_id = current_user_id,
    status = 'accepted',
    accepted_at = now()
  where id = p_job_id
    and status = 'pending'
    and worker_id is null
  returning * into updated_job;

  if not found then
    raise exception 'Job is no longer available';
  end if;

  insert into public.job_assignments (job_id, worker_id, status, responded_at)
  values (p_job_id, current_user_id, 'accepted', now())
  on conflict (job_id, worker_id)
  do update set
    status = 'accepted',
    responded_at = excluded.responded_at;

  return updated_job;
end;
$$;

create or replace function public.complete_job(
  p_job_id uuid,
  p_final_price numeric
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  company_fee numeric(10, 2);
  worker_payout numeric(10, 2);
  updated_job public.jobs%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_worker_user(current_user_id) then
    raise exception 'Only workers can complete jobs' using errcode = '42501';
  end if;

  select payout.company_fee_amount, payout.worker_payout_amount
  into company_fee, worker_payout
  from public.calculate_marketplace_payout(p_final_price) as payout;

  update public.jobs
  set
    final_price = round(p_final_price, 2),
    company_fee_amount = company_fee,
    worker_payout_amount = worker_payout,
    status = 'completed',
    completed_at = now()
  where id = p_job_id
    and worker_id = current_user_id
    and status in ('accepted', 'in_progress')
  returning * into updated_job;

  if not found then
    raise exception 'Only the assigned worker can complete an active job' using errcode = '42501';
  end if;

  update public.job_assignments
  set
    status = 'completed',
    responded_at = now()
  where job_id = p_job_id
    and worker_id = current_user_id;

  return updated_job;
end;
$$;

create or replace function public.mark_job_paid(
  p_job_id uuid,
  p_method text
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_job public.jobs%rowtype;
  due_amount numeric(10, 2);
  company_fee numeric(10, 2);
  worker_payout numeric(10, 2);
  updated_job public.jobs%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_method is null or p_method not in ('card', 'upi', 'cash') then
    raise exception 'Unsupported payment method';
  end if;

  select *
  into existing_job
  from public.jobs
  where id = p_job_id
    and user_id = current_user_id;

  if not found then
    raise exception 'Job not found' using errcode = '42501';
  end if;

  if existing_job.status <> 'completed' then
    raise exception 'Only completed jobs can be paid';
  end if;

  if existing_job.payment_status = 'paid' then
    return existing_job;
  end if;

  due_amount = coalesce(existing_job.final_price, existing_job.estimated_price);

  select payout.company_fee_amount, payout.worker_payout_amount
  into company_fee, worker_payout
  from public.calculate_marketplace_payout(due_amount) as payout;

  update public.jobs
  set
    payment_status = 'paid',
    payment_method = p_method,
    payment_reference = 'PAY-' || replace(gen_random_uuid()::text, '-', ''),
    paid_at = now(),
    company_fee_amount = company_fee,
    worker_payout_amount = worker_payout
  where id = p_job_id
  returning * into updated_job;

  return updated_job;
end;
$$;

create or replace function public.rate_worker(
  p_job_id uuid,
  p_rating integer,
  p_comment text default null
)
returns public.worker_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  updated_rating public.worker_ratings%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select *
  into target_job
  from public.jobs
  where id = p_job_id
    and user_id = current_user_id
    and status = 'completed'
    and worker_id is not null;

  if not found then
    raise exception 'Only the customer can rate the assigned worker after completion' using errcode = '42501';
  end if;

  insert into public.worker_ratings (
    job_id,
    from_user_id,
    to_worker_id,
    rating,
    comment
  )
  values (
    p_job_id,
    current_user_id,
    target_job.worker_id,
    p_rating,
    nullif(btrim(p_comment), '')
  )
  on conflict (job_id, from_user_id)
  do update set
    to_worker_id = excluded.to_worker_id,
    rating = excluded.rating,
    comment = excluded.comment,
    created_at = now()
  returning * into updated_rating;

  return updated_rating;
end;
$$;

create or replace function public.staff_update_job_status(
  p_job_id uuid,
  p_status public.job_status
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_job public.jobs%rowtype;
begin
  if current_user_id is null or not public.has_staff_access(current_user_id) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if p_status is null then
    raise exception 'Status is required';
  end if;

  update public.jobs
  set
    status = p_status,
    completed_at = case
      when p_status = 'completed' and completed_at is null then now()
      when p_status <> 'completed' then null
      else completed_at
    end
  where id = p_job_id
  returning * into updated_job;

  if not found then
    raise exception 'Job not found';
  end if;

  return updated_job;
end;
$$;

drop policy if exists jobs_users_update_own on public.jobs;
drop policy if exists jobs_workers_accept_pending on public.jobs;
drop policy if exists jobs_workers_progress_owned on public.jobs;
drop policy if exists jobs_staff_update_all on public.jobs;
drop policy if exists job_assignments_workers_insert on public.job_assignments;
drop policy if exists job_assignments_workers_respond on public.job_assignments;
drop policy if exists worker_ratings_users_create on public.worker_ratings;

revoke all on function public.calculate_marketplace_payout(numeric) from public;
revoke all on function public.accept_job(uuid) from public;
revoke all on function public.complete_job(uuid, numeric) from public;
revoke all on function public.mark_job_paid(uuid, text) from public;
revoke all on function public.rate_worker(uuid, integer, text) from public;
revoke all on function public.staff_update_job_status(uuid, public.job_status) from public;

grant execute on function public.accept_job(uuid) to authenticated;
grant execute on function public.complete_job(uuid, numeric) to authenticated;
grant execute on function public.mark_job_paid(uuid, text) to authenticated;
grant execute on function public.rate_worker(uuid, integer, text) to authenticated;
grant execute on function public.staff_update_job_status(uuid, public.job_status) to authenticated;
