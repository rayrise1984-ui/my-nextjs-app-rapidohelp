create or replace function public.accept_job(p_job_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  worker_profile public.profiles%rowtype;
  target_job public.jobs%rowtype;
  updated_job public.jobs%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into worker_profile
  from public.profiles
  where id = current_user_id
    and is_worker = true
    and worker_profile_completed = true;

  if not found then
    raise exception 'Only workers with completed profiles can accept jobs' using errcode = '42501';
  end if;

  if worker_profile.worker_status is distinct from 'online'::public.worker_status then
    raise exception 'Go online before accepting jobs';
  end if;

  select *
  into target_job
  from public.jobs
  where id = p_job_id
    and status = 'pending'
    and worker_id is null;

  if not found then
    raise exception 'Job is no longer available';
  end if;

  if not (target_job.service_type = any(coalesce(worker_profile.service_types, array[]::public.service_type[]))) then
    raise exception 'This job does not match your selected services' using errcode = '42501';
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

  update public.profiles
  set worker_status = 'on_job'
  where id = current_user_id;

  return updated_job;
end;
$$;

create or replace function public.start_job(p_job_id uuid)
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

  if not public.is_worker_user(current_user_id) then
    raise exception 'Only workers can start jobs' using errcode = '42501';
  end if;

  update public.jobs
  set status = 'in_progress'
  where id = p_job_id
    and worker_id = current_user_id
    and status = 'accepted'
  returning * into updated_job;

  if not found then
    raise exception 'Only the assigned worker can start an accepted job' using errcode = '42501';
  end if;

  update public.profiles
  set worker_status = 'on_job'
  where id = current_user_id;

  return updated_job;
end;
$$;

create or replace function public.cancel_worker_job(p_job_id uuid)
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

  if not public.is_worker_user(current_user_id) then
    raise exception 'Only workers can cancel assigned jobs' using errcode = '42501';
  end if;

  update public.jobs
  set status = 'cancelled_by_worker'
  where id = p_job_id
    and worker_id = current_user_id
    and status in ('accepted', 'in_progress')
  returning * into updated_job;

  if not found then
    raise exception 'Only the assigned worker can cancel an active job' using errcode = '42501';
  end if;

  update public.job_assignments
  set
    status = 'declined',
    responded_at = now()
  where job_id = p_job_id
    and worker_id = current_user_id;

  update public.profiles
  set worker_status = 'online'
  where id = current_user_id;

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

  update public.profiles
  set worker_status = 'online'
  where id = current_user_id;

  return updated_job;
end;
$$;

revoke all on function public.start_job(uuid) from public;
revoke all on function public.cancel_worker_job(uuid) from public;

grant execute on function public.start_job(uuid) to authenticated;
grant execute on function public.cancel_worker_job(uuid) to authenticated;
