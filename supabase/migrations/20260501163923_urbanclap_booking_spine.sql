alter table public.jobs
  add column if not exists service_address text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists preferred_worker_id uuid references auth.users(id) on delete set null,
  add column if not exists booking_payment_method text;

create index if not exists jobs_scheduled_for on public.jobs (scheduled_for);
create index if not exists jobs_preferred_worker_id on public.jobs (preferred_worker_id);

do $$
begin
  alter table public.jobs
    add constraint jobs_booking_payment_method_check
    check (booking_payment_method is null or booking_payment_method in ('card', 'upi', 'cash'));
exception
  when duplicate_object then null;
end $$;

create or replace function public.offer_preferred_worker_for_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preferred_worker public.profiles%rowtype;
begin
  new.service_address = nullif(btrim(new.service_address), '');
  new.booking_payment_method = case
    when new.booking_payment_method is null then null
    else lower(btrim(new.booking_payment_method))
  end;

  if new.service_address is null then
    raise exception 'Service address is required';
  end if;

  if new.scheduled_for is null then
    raise exception 'Scheduled time is required';
  end if;

  if new.booking_payment_method is null then
    raise exception 'Booking payment method is required';
  end if;

  if new.preferred_worker_id is null then
    return new;
  end if;

  select *
  into preferred_worker
  from public.profiles
  where id = new.preferred_worker_id
    and is_worker = true
    and worker_profile_completed = true
    and coalesce(worker_verified, false) = true
    and coalesce(worker_disabled, false) = false;

  if not found then
    raise exception 'Preferred service partner is not available';
  end if;

  if not (new.service_type = any(coalesce(preferred_worker.service_types, array[]::public.service_type[]))) then
    raise exception 'Preferred service partner does not support this service';
  end if;

  insert into public.job_assignments (job_id, worker_id, status, offered_at)
  values (new.id, new.preferred_worker_id, 'offered', now())
  on conflict (job_id, worker_id)
  do update set
    status = 'offered',
    offered_at = excluded.offered_at,
    responded_at = null;

  return new;
end;
$$;

drop trigger if exists offer_preferred_worker_for_job on public.jobs;

create trigger offer_preferred_worker_for_job
after insert on public.jobs
for each row execute procedure public.offer_preferred_worker_for_job();
