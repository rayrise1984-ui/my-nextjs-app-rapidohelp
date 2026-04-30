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
