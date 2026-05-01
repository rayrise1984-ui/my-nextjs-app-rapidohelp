create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  title text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists activity_events_created_at_idx
  on public.activity_events (created_at desc);

create index if not exists activity_events_entity_idx
  on public.activity_events (entity_type, entity_id, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "Staff can read activity events" on public.activity_events;
create policy "Staff can read activity events"
on public.activity_events
for select
to authenticated
using (public.has_staff_access());

create or replace function public.record_activity_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_row jsonb;
  old_row jsonb;
  entity_id uuid;
  title text;
  summary text;
  activity_details jsonb;
begin
  if tg_op = 'DELETE' then
    old_row := to_jsonb(old);
    new_row := null;
  elsif tg_op = 'INSERT' then
    new_row := to_jsonb(new);
    old_row := null;
  else
    new_row := to_jsonb(new);
    old_row := to_jsonb(old);
  end if;

  begin
    entity_id := coalesce((new_row->>'id')::uuid, (old_row->>'id')::uuid);
  exception
    when others then
      entity_id := null;
  end;

  activity_details := jsonb_build_object('new', new_row, 'old', old_row);

  case tg_table_name
    when 'jobs' then
      title := 'Job activity';
      if tg_op = 'INSERT' then
        summary :=
          coalesce(new_row->>'service_type', 'Job')
          || ' posted for '
          || coalesce(new_row->>'location_name', new_row->>'service_address', 'unknown location');
      elsif tg_op = 'UPDATE' then
        if new_row->>'status' is distinct from old_row->>'status' then
          summary :=
            'Status changed from '
            || coalesce(old_row->>'status', 'unknown')
            || ' to '
            || coalesce(new_row->>'status', 'unknown');
        elsif new_row->>'payment_status' is distinct from old_row->>'payment_status' then
          summary :=
            'Payment changed from '
            || coalesce(old_row->>'payment_status', 'unknown')
            || ' to '
            || coalesce(new_row->>'payment_status', 'unknown');
        elsif new_row->>'worker_id' is distinct from old_row->>'worker_id' then
          summary := 'Worker assignment changed';
        else
          summary := coalesce(new_row->>'service_type', 'Job') || ' updated';
        end if;
      else
        summary := coalesce(old_row->>'service_type', 'Job') || ' deleted';
      end if;
    when 'profiles' then
      title := 'Profile activity';
      if tg_op = 'INSERT' then
        summary :=
          coalesce(new_row->>'full_name', new_row->>'id', 'Profile')
          || ' created as '
          || coalesce(new_row->>'role', 'customer');
      elsif tg_op = 'UPDATE' then
        if new_row->>'worker_verified' is distinct from old_row->>'worker_verified' then
          summary :=
            coalesce(new_row->>'full_name', new_row->>'id', 'Profile')
            || ' verification '
            || case when coalesce(new_row->>'worker_verified', 'false') = 'true' then 'approved' else 'revoked' end;
        elsif new_row->>'worker_disabled' is distinct from old_row->>'worker_disabled' then
          summary :=
            coalesce(new_row->>'full_name', new_row->>'id', 'Profile')
            || ' access '
            || case when coalesce(new_row->>'worker_disabled', 'false') = 'true' then 'paused' else 'restored' end;
        elsif new_row->>'worker_profile_completed' is distinct from old_row->>'worker_profile_completed' then
          summary := coalesce(new_row->>'full_name', new_row->>'id', 'Profile') || ' completion updated';
        elsif new_row->>'worker_status' is distinct from old_row->>'worker_status' then
          summary := coalesce(new_row->>'full_name', new_row->>'id', 'Profile') || ' worker status changed';
        elsif new_row->>'total_earnings' is distinct from old_row->>'total_earnings' then
          summary := coalesce(new_row->>'full_name', new_row->>'id', 'Profile') || ' earnings updated';
        else
          summary := coalesce(new_row->>'full_name', new_row->>'id', 'Profile') || ' updated';
        end if;
      else
        summary := coalesce(old_row->>'full_name', old_row->>'id', 'Profile') || ' deleted';
      end if;
    when 'support_requests' then
      title := 'Support request activity';
      if tg_op = 'INSERT' then
        summary := coalesce(new_row->>'title', 'Support request') || ' opened';
      elsif tg_op = 'UPDATE' then
        if new_row->>'status' is distinct from old_row->>'status' then
          summary :=
            'Status changed from '
            || coalesce(old_row->>'status', 'unknown')
            || ' to '
            || coalesce(new_row->>'status', 'unknown');
        elsif new_row->>'priority' is distinct from old_row->>'priority' then
          summary :=
            'Priority changed from '
            || coalesce(old_row->>'priority', 'unknown')
            || ' to '
            || coalesce(new_row->>'priority', 'unknown');
        else
          summary := coalesce(new_row->>'title', 'Support request') || ' updated';
        end if;
      else
        summary := coalesce(old_row->>'title', 'Support request') || ' deleted';
      end if;
    when 'support_request_comments' then
      title := case when coalesce(new_row->>'is_internal', old_row->>'is_internal') = 'true' then 'Internal support note' else 'Support reply' end;
      if tg_op = 'DELETE' then
        summary := 'Comment removed';
      elsif tg_op = 'INSERT' then
        summary := substr(coalesce(new_row->>'body', ''), 1, 160);
      else
        summary := 'Comment updated';
      end if;
    when 'worker_background_checks' then
      title := 'Background check activity';
      if tg_op = 'INSERT' then
        summary := 'Background check submitted';
      elsif tg_op = 'UPDATE' then
        if new_row->>'status' is distinct from old_row->>'status' then
          summary :=
            'Status changed from '
            || coalesce(old_row->>'status', 'unknown')
            || ' to '
            || coalesce(new_row->>'status', 'unknown');
        elsif new_row->>'payout_account_last4' is distinct from old_row->>'payout_account_last4'
          or new_row->>'payout_routing_last4' is distinct from old_row->>'payout_routing_last4'
          or new_row->>'payout_account_type' is distinct from old_row->>'payout_account_type' then
          summary := 'Payout details updated';
        else
          summary := 'Background details updated';
        end if;
      else
        summary := 'Background check removed';
      end if;
    when 'worker_ratings' then
      title := 'Rating activity';
      if tg_op = 'INSERT' then
        summary := 'Rating submitted: ' || coalesce(new_row->>'rating', '0') || ' stars';
      elsif tg_op = 'UPDATE' then
        summary := 'Rating updated';
      else
        summary := 'Rating removed';
      end if;
    when 'job_assignments' then
      title := 'Assignment activity';
      if tg_op = 'INSERT' then
        summary := 'Assignment ' || coalesce(new_row->>'status', 'created');
      elsif tg_op = 'UPDATE' then
        summary := 'Assignment ' || coalesce(new_row->>'status', 'updated');
      else
        summary := 'Assignment removed';
      end if;
    else
      title := initcap(replace(tg_table_name, '_', ' ')) || ' activity';
      summary := lower(tg_op) || ' event';
  end case;

  insert into public.activity_events (
    actor_id,
    entity_type,
    entity_id,
    action,
    title,
    summary,
    details
  )
  values (
    current_user_id,
    tg_table_name,
    entity_id,
    lower(tg_op),
    title,
    summary,
    activity_details
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists log_job_activity on public.jobs;
create trigger log_job_activity
  after insert or update or delete on public.jobs
  for each row execute procedure public.record_activity_event();

drop trigger if exists log_profile_activity on public.profiles;
create trigger log_profile_activity
  after insert or update or delete on public.profiles
  for each row execute procedure public.record_activity_event();

drop trigger if exists log_support_request_activity on public.support_requests;
create trigger log_support_request_activity
  after insert or update or delete on public.support_requests
  for each row execute procedure public.record_activity_event();

drop trigger if exists log_support_comment_activity on public.support_request_comments;
create trigger log_support_comment_activity
  after insert or update or delete on public.support_request_comments
  for each row execute procedure public.record_activity_event();

drop trigger if exists log_background_check_activity on public.worker_background_checks;
create trigger log_background_check_activity
  after insert or update or delete on public.worker_background_checks
  for each row execute procedure public.record_activity_event();

drop trigger if exists log_worker_rating_activity on public.worker_ratings;
create trigger log_worker_rating_activity
  after insert or update or delete on public.worker_ratings
  for each row execute procedure public.record_activity_event();

drop trigger if exists log_job_assignment_activity on public.job_assignments;
create trigger log_job_assignment_activity
  after insert or update or delete on public.job_assignments
  for each row execute procedure public.record_activity_event();
