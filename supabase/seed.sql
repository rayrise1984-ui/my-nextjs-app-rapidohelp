insert into public.profiles (id, full_name)
values ('00000000-0000-0000-0000-000000000000', 'Demo User')
on conflict (id) do nothing;