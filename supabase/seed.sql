insert into public.profiles (id, full_name, role, is_worker)
values ('00000000-0000-0000-0000-000000000000', 'Demo User', 'customer', false)
on conflict (id) do nothing;
