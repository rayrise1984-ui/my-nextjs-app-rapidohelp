alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists terms_acceptance_method text,
  add column if not exists terms_accepted_platform text;

do $$
begin
  alter table public.profiles
    add constraint profiles_terms_acceptance_method_check
    check (
      terms_acceptance_method is null
      or terms_acceptance_method in ('clickwrap')
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_terms_accepted_platform_check
    check (
      terms_accepted_platform is null
      or terms_accepted_platform in ('web', 'mobile')
    );
exception when duplicate_object then
  null;
end $$;

create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  accepting_terms boolean := current_setting('app.accepting_terms', true) = 'true';
begin
  if current_user_id is not null and not public.has_staff_access(current_user_id) then
    new.role = old.role;
    new.is_worker = old.is_worker;
    new.worker_rating_avg = old.worker_rating_avg;
    new.worker_rating_count = old.worker_rating_count;
    new.total_earnings = old.total_earnings;
    new.worker_verified = old.worker_verified;
    new.worker_disabled = old.worker_disabled;

    if not accepting_terms then
      new.terms_accepted_at = old.terms_accepted_at;
      new.terms_version = old.terms_version;
      new.terms_acceptance_method = old.terms_acceptance_method;
      new.terms_accepted_platform = old.terms_accepted_platform;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.accept_terms(
  p_terms_version text,
  p_platform text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_profile public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if nullif(btrim(p_terms_version), '') is null then
    raise exception 'Terms version is required';
  end if;

  if p_platform is null or p_platform not in ('web', 'mobile') then
    raise exception 'Unsupported acceptance platform';
  end if;

  perform set_config('app.accepting_terms', 'true', true);

  update public.profiles
  set
    terms_accepted_at = now(),
    terms_version = btrim(p_terms_version),
    terms_acceptance_method = 'clickwrap',
    terms_accepted_platform = p_platform
  where id = current_user_id
  returning * into updated_profile;

  if not found then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.accept_terms(text, text) from public;
grant execute on function public.accept_terms(text, text) to authenticated;
