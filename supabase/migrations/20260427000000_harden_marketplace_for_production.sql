alter table public.profiles
  add column if not exists worker_work_details text,
  add column if not exists worker_experience_years integer,
  add column if not exists worker_profile_completed boolean not null default false;

alter table public.profiles
  add constraint profiles_worker_experience_non_negative
  check (worker_experience_years is null or worker_experience_years >= 0);

drop policy if exists "Authenticated can read completed worker profiles" on public.profiles;

create policy "Authenticated can read completed worker profiles"
on public.profiles
for select
to authenticated
using (
  is_worker = true
  and worker_profile_completed = true
);

drop policy if exists jobs_staff_read_all on public.jobs;
drop policy if exists jobs_staff_update_all on public.jobs;

create policy jobs_staff_read_all
on public.jobs
for select
to authenticated
using (public.has_staff_access());

create policy jobs_staff_update_all
on public.jobs
for update
to authenticated
using (public.has_staff_access())
with check (public.has_staff_access());

drop policy if exists job_assignments_staff_read_all on public.job_assignments;

create policy job_assignments_staff_read_all
on public.job_assignments
for select
to authenticated
using (public.has_staff_access());

drop policy if exists worker_ratings_staff_read_all on public.worker_ratings;

create policy worker_ratings_staff_read_all
on public.worker_ratings
for select
to authenticated
using (public.has_staff_access());

create or replace function public.refresh_worker_rating_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_worker_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_worker_id = old.to_worker_id;
  else
    affected_worker_id = new.to_worker_id;
  end if;

  update public.profiles
  set
    worker_rating_avg = summary.rating_avg,
    worker_rating_count = summary.rating_count
  from (
    select
      coalesce(round(avg(rating)::numeric, 2), 0) as rating_avg,
      count(*)::integer as rating_count
    from public.worker_ratings
    where to_worker_id = affected_worker_id
  ) as summary
  where id = affected_worker_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_worker_rating_summary on public.worker_ratings;

create trigger refresh_worker_rating_summary
after insert or update or delete on public.worker_ratings
for each row execute procedure public.refresh_worker_rating_summary();

create or replace function public.refresh_worker_earnings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.worker_id is not null then
    update public.profiles
    set total_earnings = (
      select coalesce(sum(worker_payout_amount), 0)
      from public.jobs
      where worker_id = new.worker_id
        and status = 'completed'
        and payment_status = 'paid'
    )
    where id = new.worker_id;
  end if;

  if old.worker_id is not null and old.worker_id is distinct from new.worker_id then
    update public.profiles
    set total_earnings = (
      select coalesce(sum(worker_payout_amount), 0)
      from public.jobs
      where worker_id = old.worker_id
        and status = 'completed'
        and payment_status = 'paid'
    )
    where id = old.worker_id;
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_worker_earnings on public.jobs;

create trigger refresh_worker_earnings
after update of worker_id, status, payment_status, worker_payout_amount on public.jobs
for each row execute procedure public.refresh_worker_earnings();
