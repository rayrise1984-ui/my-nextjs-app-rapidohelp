alter table public.profiles
  add column if not exists worker_verified boolean not null default false,
  add column if not exists worker_disabled boolean not null default false;

update public.profiles
set worker_verified = true
where is_worker = true
  and worker_profile_completed = true
  and worker_verified = false;

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
    new.worker_verified = old.worker_verified;
    new.worker_disabled = old.worker_disabled;
  end if;

  return new;
end;
$$;

create or replace function public.staff_update_worker_access(
  p_worker_id uuid,
  p_worker_verified boolean,
  p_worker_disabled boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_worker public.profiles%rowtype;
begin
  if current_user_id is null or not public.has_staff_access(current_user_id) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if p_worker_id is null then
    raise exception 'Worker id is required';
  end if;

  if p_worker_verified is null or p_worker_disabled is null then
    raise exception 'Worker access flags are required';
  end if;

  update public.profiles
  set
    worker_verified = p_worker_verified,
    worker_disabled = p_worker_disabled,
    worker_status = case
      when exists (
        select 1
        from public.jobs
        where worker_id = p_worker_id
          and status in ('accepted', 'in_progress')
      ) then worker_status
      when p_worker_disabled or not p_worker_verified then 'offline'::public.worker_status
      else worker_status
    end
  where id = p_worker_id
    and is_worker = true
  returning * into updated_worker;

  if not found then
    raise exception 'Worker profile not found';
  end if;

  return updated_worker;
end;
$$;

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

  if worker_profile.worker_disabled then
    raise exception 'Your worker access is paused. Contact support.' using errcode = '42501';
  end if;

  if not worker_profile.worker_verified then
    raise exception 'Your worker profile is waiting for staff verification' using errcode = '42501';
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

revoke all on function public.staff_update_worker_access(uuid, boolean, boolean) from public;

grant execute on function public.staff_update_worker_access(uuid, boolean, boolean) to authenticated;
