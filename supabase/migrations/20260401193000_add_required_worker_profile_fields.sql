alter table public.profiles
  add column if not exists worker_work_details text,
  add column if not exists worker_experience_years integer,
  add column if not exists worker_profile_completed boolean not null default false;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_worker_experience_years_check'
  ) then
    alter table public.profiles
      add constraint profiles_worker_experience_years_check
      check (worker_experience_years is null or worker_experience_years >= 0);
  end if;
end;
$$;
