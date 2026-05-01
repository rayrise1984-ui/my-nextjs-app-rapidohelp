create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'helpdesk@rapidohelp.com' then
    return new;
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.has_staff_access(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = check_user_id
      and lower(email) = 'helpdesk@rapidohelp.com'
  )
  or exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role in ('agent', 'admin')
  );
$$;
