drop policy if exists "Public can read worker profiles" on public.profiles;
create policy "Public can read worker profiles"
on public.profiles
for select
to public
using (is_worker = true);
