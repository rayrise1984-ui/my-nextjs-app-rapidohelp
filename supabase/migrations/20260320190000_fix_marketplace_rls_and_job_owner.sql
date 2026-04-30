create or replace function public.is_worker_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and is_worker = true
  );
$$;
create or replace function public.set_job_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists set_job_owner on public.jobs;
create trigger set_job_owner
  before insert on public.jobs
  for each row execute procedure public.set_job_owner();
drop policy if exists jobs_workers_see_offered on public.jobs;
create policy jobs_workers_read_pending_or_assigned
on public.jobs
for select
to authenticated
using (
  public.is_worker_user()
  and (
    status = 'pending'
    or worker_id = auth.uid()
  )
);
create policy jobs_workers_accept_pending
on public.jobs
for update
to authenticated
using (
  public.is_worker_user()
  and status = 'pending'
)
with check (
  worker_id = auth.uid()
  and status = 'accepted'
);
create policy jobs_workers_progress_owned
on public.jobs
for update
to authenticated
using (
  public.is_worker_user()
  and worker_id = auth.uid()
  and status in ('accepted', 'in_progress')
)
with check (
  worker_id = auth.uid()
  and status in ('accepted', 'in_progress', 'completed', 'cancelled_by_worker')
);
