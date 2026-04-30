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
