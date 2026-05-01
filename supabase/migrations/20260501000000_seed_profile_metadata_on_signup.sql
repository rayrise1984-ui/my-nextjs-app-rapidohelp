create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role public.app_role := case new.raw_user_meta_data ->> 'role'
    when 'agent' then 'agent'::public.app_role
    when 'admin' then 'admin'::public.app_role
    else 'customer'::public.app_role
  end;
  next_is_worker boolean := case
    when lower(coalesce(new.raw_user_meta_data ->> 'is_worker', '')) in ('true', '1', 'yes', 'on') then true
    when next_role <> 'customer'::public.app_role then true
    else false
  end;
begin
  insert into public.profiles (id, full_name, role, is_worker)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    next_role,
    next_is_worker
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
