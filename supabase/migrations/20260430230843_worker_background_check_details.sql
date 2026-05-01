create table if not exists public.worker_background_checks (
  worker_id uuid primary key references public.profiles(id) on delete cascade,
  legal_full_name text not null,
  ssn_last4 text not null,
  driver_license_number text not null,
  driver_license_state text not null,
  legal_address_line1 text not null,
  legal_address_line2 text,
  legal_city text not null,
  legal_state text not null,
  legal_postal_code text not null,
  status text not null default 'submitted',
  submitted_at timestamptz not null default timezone('utc'::text, now()),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  staff_notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

do $$
begin
  alter table public.worker_background_checks
    add constraint worker_background_checks_ssn_last4_check
    check (ssn_last4 ~ '^[0-9]{4}$');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.worker_background_checks
    add constraint worker_background_checks_driver_license_state_check
    check (driver_license_state ~ '^[A-Z]{2}$');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.worker_background_checks
    add constraint worker_background_checks_legal_state_check
    check (legal_state ~ '^[A-Z]{2}$');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.worker_background_checks
    add constraint worker_background_checks_status_check
    check (status in ('submitted', 'in_review', 'needs_info', 'cleared', 'rejected'));
exception when duplicate_object then
  null;
end $$;

alter table public.worker_background_checks enable row level security;

drop trigger if exists set_worker_background_checks_updated_at on public.worker_background_checks;
create trigger set_worker_background_checks_updated_at
  before update on public.worker_background_checks
  for each row execute procedure public.set_current_timestamp_updated_at();

drop policy if exists "Workers can read their own background check" on public.worker_background_checks;
create policy "Workers can read their own background check"
on public.worker_background_checks
for select
to authenticated
using (auth.uid() = worker_id);

drop policy if exists "Staff can read worker background checks" on public.worker_background_checks;
create policy "Staff can read worker background checks"
on public.worker_background_checks
for select
to authenticated
using (public.has_staff_access());

create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  accepting_terms boolean := current_setting('app.accepting_terms', true) = 'true';
  submitting_worker_profile boolean := current_setting('app.submitting_worker_profile', true) = 'true';
begin
  if current_user_id is not null and not public.has_staff_access(current_user_id) then
    new.role = old.role;
    new.worker_rating_avg = old.worker_rating_avg;
    new.worker_rating_count = old.worker_rating_count;
    new.total_earnings = old.total_earnings;
    new.worker_verified = old.worker_verified;
    new.worker_disabled = old.worker_disabled;

    if submitting_worker_profile and new.id = current_user_id then
      new.is_worker = true;
    else
      new.is_worker = old.is_worker;
      new.worker_profile_completed = old.worker_profile_completed;
    end if;

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

create or replace function public.submit_worker_profile(
  p_worker_status public.worker_status,
  p_worker_work_details text,
  p_worker_experience_years integer,
  p_service_types public.service_type[],
  p_legal_full_name text,
  p_ssn_last4 text,
  p_driver_license_number text,
  p_driver_license_state text,
  p_legal_address_line1 text,
  p_legal_address_line2 text,
  p_legal_city text,
  p_legal_state text,
  p_legal_postal_code text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_status public.worker_status := coalesce(p_worker_status, 'offline'::public.worker_status);
  normalized_details text := btrim(coalesce(p_worker_work_details, ''));
  normalized_service_types public.service_type[] := coalesce(p_service_types, array[]::public.service_type[]);
  normalized_legal_full_name text := btrim(coalesce(p_legal_full_name, ''));
  normalized_ssn_last4 text := regexp_replace(coalesce(p_ssn_last4, ''), '\D', '', 'g');
  normalized_driver_license_number text := upper(btrim(coalesce(p_driver_license_number, '')));
  normalized_driver_license_state text := upper(btrim(coalesce(p_driver_license_state, '')));
  normalized_address_line1 text := btrim(coalesce(p_legal_address_line1, ''));
  normalized_address_line2 text := nullif(btrim(coalesce(p_legal_address_line2, '')), '');
  normalized_city text := btrim(coalesce(p_legal_city, ''));
  normalized_state text := upper(btrim(coalesce(p_legal_state, '')));
  normalized_postal_code text := upper(btrim(coalesce(p_legal_postal_code, '')));
  updated_profile public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if normalized_details = '' or length(normalized_details) < 10 then
    raise exception 'Work details must be at least 10 characters';
  end if;

  if p_worker_experience_years is null or p_worker_experience_years < 0 then
    raise exception 'Experience years must be zero or greater';
  end if;

  if array_length(normalized_service_types, 1) is null then
    raise exception 'Select at least one service';
  end if;

  if normalized_legal_full_name = '' then
    raise exception 'Legal full name is required';
  end if;

  if normalized_ssn_last4 !~ '^[0-9]{4}$' then
    raise exception 'SSN last 4 must be exactly 4 digits';
  end if;

  if length(normalized_driver_license_number) < 3 then
    raise exception 'Driver license number is required';
  end if;

  if normalized_driver_license_state !~ '^[A-Z]{2}$' then
    raise exception 'Driver license state must be a two-letter state code';
  end if;

  if normalized_address_line1 = '' or normalized_city = '' or normalized_state = '' or normalized_postal_code = '' then
    raise exception 'Legal address is required';
  end if;

  if normalized_state !~ '^[A-Z]{2}$' then
    raise exception 'Address state must be a two-letter state code';
  end if;

  if length(normalized_postal_code) < 3 or length(normalized_postal_code) > 20 then
    raise exception 'Postal code is invalid';
  end if;

  perform set_config('app.submitting_worker_profile', 'true', true);

  update public.profiles
  set
    is_worker = true,
    worker_status = case
      when worker_status = 'on_job'::public.worker_status then worker_status
      when worker_verified and not worker_disabled then normalized_status
      else 'offline'::public.worker_status
    end,
    worker_work_details = normalized_details,
    worker_experience_years = p_worker_experience_years,
    service_types = normalized_service_types,
    worker_profile_completed = true
  where id = current_user_id
  returning * into updated_profile;

  if not found then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  insert into public.worker_background_checks (
    worker_id,
    legal_full_name,
    ssn_last4,
    driver_license_number,
    driver_license_state,
    legal_address_line1,
    legal_address_line2,
    legal_city,
    legal_state,
    legal_postal_code,
    status,
    submitted_at,
    reviewed_at,
    reviewed_by
  )
  values (
    current_user_id,
    normalized_legal_full_name,
    normalized_ssn_last4,
    normalized_driver_license_number,
    normalized_driver_license_state,
    normalized_address_line1,
    normalized_address_line2,
    normalized_city,
    normalized_state,
    normalized_postal_code,
    'submitted',
    timezone('utc'::text, now()),
    null,
    null
  )
  on conflict (worker_id)
  do update set
    legal_full_name = excluded.legal_full_name,
    ssn_last4 = excluded.ssn_last4,
    driver_license_number = excluded.driver_license_number,
    driver_license_state = excluded.driver_license_state,
    legal_address_line1 = excluded.legal_address_line1,
    legal_address_line2 = excluded.legal_address_line2,
    legal_city = excluded.legal_city,
    legal_state = excluded.legal_state,
    legal_postal_code = excluded.legal_postal_code,
    status = 'submitted',
    submitted_at = timezone('utc'::text, now()),
    reviewed_at = null,
    reviewed_by = null;

  return updated_profile;
end;
$$;

revoke all on function public.submit_worker_profile(public.worker_status, text, integer, public.service_type[], text, text, text, text, text, text, text, text, text) from public;

grant execute on function public.submit_worker_profile(public.worker_status, text, integer, public.service_type[], text, text, text, text, text, text, text, text, text) to authenticated;
