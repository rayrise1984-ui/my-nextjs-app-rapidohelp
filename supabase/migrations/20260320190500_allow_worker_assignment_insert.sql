create policy job_assignments_workers_insert
on public.job_assignments
for insert
to authenticated
with check (
  auth.uid() = worker_id
  and exists (
    select 1
    from public.jobs j
    where j.id = job_id
      and (j.status = 'pending' or j.worker_id = auth.uid())
  )
);
