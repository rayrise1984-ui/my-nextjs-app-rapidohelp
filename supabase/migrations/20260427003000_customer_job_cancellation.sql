create or replace function public.cancel_job(p_job_id uuid)
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

  update public.jobs
  set
    status = 'cancelled',
    worker_id = null,
    accepted_at = null,
    completed_at = null
  where id = p_job_id
    and user_id = current_user_id
    and status = 'pending'
    and worker_id is null
  returning * into updated_job;

  if not found then
    raise exception 'Only pending, unassigned jobs can be cancelled by the customer' using errcode = '42501';
  end if;

  return updated_job;
end;
$$;

revoke all on function public.cancel_job(uuid) from public;
grant execute on function public.cancel_job(uuid) to authenticated;
