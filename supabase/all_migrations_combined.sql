-- ===== 20260320000000_init.sql =====
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create policy "Users can read their own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_current_timestamp_updated_at();
-- ===== 20260320001000_support_requests.sql =====
create type public.request_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.request_status as enum ('open', 'in_progress', 'resolved', 'closed');

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  priority public.request_priority not null default 'medium',
  status public.request_status not null default 'open',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.support_request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists support_requests_user_id_idx
  on public.support_requests (user_id, created_at desc);

create index if not exists support_request_comments_request_id_idx
  on public.support_request_comments (request_id, created_at asc);

alter table public.support_requests enable row level security;
alter table public.support_request_comments enable row level security;

create or replace function public.set_support_request_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_support_request_owner on public.support_requests;

create trigger set_support_request_owner
  before insert on public.support_requests
  for each row execute procedure public.set_support_request_owner();

drop trigger if exists set_support_requests_updated_at on public.support_requests;

create trigger set_support_requests_updated_at
  before update on public.support_requests
  for each row execute procedure public.set_current_timestamp_updated_at();

create policy "Users can create their own support requests"
on public.support_requests
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can view their own support requests"
on public.support_requests
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can update open support requests"
on public.support_requests
for update
to authenticated
using (auth.uid() = user_id and status in ('open', 'in_progress'))
with check (auth.uid() = user_id);

create policy "Users can create comments on their own requests"
on public.support_request_comments
for insert
to authenticated
with check (
  auth.uid() = author_id
  and exists (
    select 1
    from public.support_requests sr
    where sr.id = request_id
      and sr.user_id = auth.uid()
  )
);

create policy "Users can read comments on their own requests"
on public.support_request_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.support_requests sr
    where sr.id = request_id
      and sr.user_id = auth.uid()
  )
);
-- ===== 20260320002000_staff_roles.sql =====
create type public.app_role as enum ('customer', 'agent', 'admin');

alter table public.profiles
  add column if not exists role public.app_role not null default 'customer';

create or replace function public.has_staff_access(check_user_id uuid default auth.uid())
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
      and role in ('agent', 'admin')
  );
$$;

create policy "Staff can read all support requests"
on public.support_requests
for select
to authenticated
using (public.has_staff_access());

create policy "Staff can update all support requests"
on public.support_requests
for update
to authenticated
using (public.has_staff_access())
with check (public.has_staff_access());

create policy "Staff can read all support request comments"
on public.support_request_comments
for select
to authenticated
using (public.has_staff_access());

create policy "Staff can create support request comments"
on public.support_request_comments
for insert
to authenticated
with check (public.has_staff_access() and auth.uid() = author_id);

create policy "Staff can read all profiles"
on public.profiles
for select
to authenticated
using (public.has_staff_access());
-- ===== 20260320003000_comment_policies.sql =====
create or replace function public.set_support_request_comment_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author_id = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_support_request_comment_author on public.support_request_comments;

create trigger set_support_request_comment_author
  before insert on public.support_request_comments
  for each row execute procedure public.set_support_request_comment_author();

drop policy if exists "Users can create comments on their own requests" on public.support_request_comments;
drop policy if exists "Users can read comments on their own requests" on public.support_request_comments;
drop policy if exists "Staff can read all support request comments" on public.support_request_comments;
drop policy if exists "Staff can create support request comments" on public.support_request_comments;

create policy "Users can create visible comments on their own requests"
on public.support_request_comments
for insert
to authenticated
with check (
  auth.uid() = author_id
  and is_internal = false
  and exists (
    select 1
    from public.support_requests sr
    where sr.id = request_id
      and sr.user_id = auth.uid()
  )
);

create policy "Users can read visible comments on their own requests"
on public.support_request_comments
for select
to authenticated
using (
  is_internal = false
  and exists (
    select 1
    from public.support_requests sr
    where sr.id = request_id
      and sr.user_id = auth.uid()
  )
);

create policy "Staff can read all support request comments"
on public.support_request_comments
for select
to authenticated
using (public.has_staff_access());

create policy "Staff can create support request comments"
on public.support_request_comments
for insert
to authenticated
with check (public.has_staff_access() and auth.uid() = author_id);
-- ===== 20260320005000_pivot_to_marketplace.sql =====
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

-- ===== 20260320183500_add_gig_help_service_types.sql =====
alter type service_type add value if not exists 'moving_help';
alter type service_type add value if not exists 'handyman_help';
alter type service_type add value if not exists 'cleaning_help';
alter type service_type add value if not exists 'delivery_help';
alter type service_type add value if not exists 'pet_help';
alter type service_type add value if not exists 'tech_help';

