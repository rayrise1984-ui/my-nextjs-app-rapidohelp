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
