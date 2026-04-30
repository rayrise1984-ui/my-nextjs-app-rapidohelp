-- Drop old support request schema
drop table if exists support_request_comments cascade;
drop table if exists support_requests cascade;
-- Create enums for marketplace
create type service_type as enum ('flat_tire', 'jump_start', 'fuel_delivery', 'towing');
create type job_status as enum ('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'cancelled_by_worker');
create type worker_status as enum ('offline', 'online', 'on_job');
-- Extend profiles with worker information
alter table profiles add column if not exists is_worker boolean default false;
alter table profiles add column if not exists worker_rating_avg numeric(3,2),
                     add column if not exists worker_rating_count integer default 0,
                     add column if not exists total_earnings numeric(10,2) default 0,
                     add column if not exists worker_status worker_status default 'offline',
                     add column if not exists service_types service_type[] default array[]::service_type[];
-- Jobs table (replaces support_requests)
create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  worker_id uuid references auth.users(id) on delete set null,
  service_type service_type not null,
  description text not null,
  location_lat numeric(10, 6) not null,
  location_lng numeric(10, 6) not null,
  location_name text,
  status job_status default 'pending',
  estimated_price numeric(8, 2),
  final_price numeric(8, 2),
  created_at timestamp with time zone default now(),
  accepted_at timestamp with time zone,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);
create index jobs_user_id on jobs(user_id);
create index jobs_worker_id on jobs(worker_id);
create index jobs_status on jobs(status);
create index jobs_created_at on jobs(created_at desc);
-- Job assignments (track offers, accepts, completions)
create table job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  status text default 'offered', -- 'offered', 'accepted', 'declined', 'completed'
  offered_at timestamp with time zone default now(),
  responded_at timestamp with time zone,
  unique(job_id, worker_id)
);
create index job_assignments_job_id on job_assignments(job_id);
create index job_assignments_worker_id on job_assignments(worker_id);
create index job_assignments_status on job_assignments(status);
-- Ratings table
create table worker_ratings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_worker_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default now(),
  unique(job_id, from_user_id)
);
create index worker_ratings_to_worker_id on worker_ratings(to_worker_id);
create index worker_ratings_job_id on worker_ratings(job_id);
-- Trigger: update jobs.updated_at
create or replace function set_jobs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
create trigger jobs_updated_at_trigger
before update on jobs
for each row
execute function set_jobs_updated_at();
-- RLS Policies

-- Jobs: users see their own jobs, workers see offered/accepted jobs
alter table jobs enable row level security;
create policy jobs_users_own_jobs on jobs
  for select
  using (auth.uid() = user_id);
create policy jobs_workers_see_offered on jobs
  for select
  using (
    auth.uid() in (
      select worker_id from job_assignments where job_id = jobs.id
    )
  );
create policy jobs_users_create on jobs
  for insert
  with check (auth.uid() = user_id);
create policy jobs_users_update_own on jobs
  for update
  using (auth.uid() = user_id);
-- Job assignments: users see their own, workers see theirs
alter table job_assignments enable row level security;
create policy job_assignments_view on job_assignments
  for select
  using (
    auth.uid() = worker_id or
    auth.uid() in (select user_id from jobs where id = job_id)
  );
create policy job_assignments_workers_respond on job_assignments
  for update
  using (auth.uid() = worker_id);
-- Worker ratings: users rate workers they've hired, workers see their ratings
alter table worker_ratings enable row level security;
create policy worker_ratings_view on worker_ratings
  for select
  using (
    auth.uid() = from_user_id or
    auth.uid() = to_worker_id
  );
create policy worker_ratings_users_create on worker_ratings
  for insert
  with check (
    auth.uid() = from_user_id and
    exists(select 1 from jobs where id = job_id and user_id = auth.uid())
  );
