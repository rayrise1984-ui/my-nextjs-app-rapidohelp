alter table public.profiles
  add column if not exists worker_background_check_consent_at timestamptz,
  add column if not exists worker_background_check_consent_platform text,
  add column if not exists worker_background_check_consent_version text;

do $$
begin
  alter table public.profiles
    add constraint profiles_worker_background_check_consent_platform_check
    check (
      worker_background_check_consent_platform is null
      or worker_background_check_consent_platform in ('web', 'mobile')
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
  accepting_worker_background_check boolean := current_setting('app.accepting_worker_background_check', true) = 'true';
  submitting_worker_profile boolean := current_setting('app.submitting_worker_profile', true) = 'true';
begin
  if current_user_id is not null and not public.has_staff_access(current_user_id) then
    new.role = old.role;
    new.worker_rating_avg = old.worker_rating_avg;
    new.worker_rating_count = old.worker_rating_count;
    new.total_earnings = old.total_earnings;
    new.worker_verified = old.worker_verified;
    new.worker_disabled = old.worker_disabled;

    if not accepting_worker_background_check then
      new.worker_background_check_consent_at = old.worker_background_check_consent_at;
      new.worker_background_check_consent_platform = old.worker_background_check_consent_platform;
      new.worker_background_check_consent_version = old.worker_background_check_consent_version;
    end if;

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

create or replace function public.accept_worker_background_check_consent(
  p_platform text,
  p_consent_version text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_platform text := lower(btrim(coalesce(p_platform, '')));
  normalized_version text := btrim(coalesce(p_consent_version, ''));
  updated_profile public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if normalized_platform not in ('web', 'mobile') then
    raise exception 'Unsupported consent platform';
  end if;

  if normalized_version = '' then
    raise exception 'Consent version is required';
  end if;

  perform set_config('app.accepting_worker_background_check', 'true', true);

  update public.profiles
  set
    worker_background_check_consent_at = timezone('utc'::text, now()),
    worker_background_check_consent_platform = normalized_platform,
    worker_background_check_consent_version = normalized_version
  where id = current_user_id
  returning * into updated_profile;

  if not found then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.accept_worker_background_check_consent(text, text) from public;
grant execute on function public.accept_worker_background_check_consent(text, text) to authenticated;

create or replace function public.is_worker_user(check_user_id uuid default auth.uid())
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
      and is_worker = true
      and worker_profile_completed = true
      and worker_background_check_consent_at is not null
      and worker_background_check_consent_platform is not null
      and worker_background_check_consent_version is not null
      and worker_verified = true
      and worker_disabled = false
  );
$$;

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
  next_worker_background_check_consent_at timestamptz := case
    when lower(coalesce(new.raw_user_meta_data ->> 'worker_background_check_consent', '')) in ('true', '1', 'yes', 'on')
      then timezone('utc'::text, now())
    else null
  end;
  next_worker_background_check_consent_platform text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'worker_background_check_consent_platform', '')), '');
  next_worker_background_check_consent_version text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'worker_background_check_consent_version', '')), '');
begin
  insert into public.profiles (
    id,
    full_name,
    role,
    is_worker,
    worker_background_check_consent_at,
    worker_background_check_consent_platform,
    worker_background_check_consent_version
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    next_role,
    next_is_worker,
    next_worker_background_check_consent_at,
    next_worker_background_check_consent_platform,
    next_worker_background_check_consent_version
  )
  on conflict (id) do nothing;
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
  p_legal_postal_code text,
  p_payout_account_holder_name text,
  p_payout_bank_name text,
  p_payout_account_type text,
  p_payout_account_last4 text,
  p_payout_routing_last4 text
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
  normalized_payout_account_holder_name text := btrim(coalesce(p_payout_account_holder_name, ''));
  normalized_payout_bank_name text := btrim(coalesce(p_payout_bank_name, ''));
  normalized_payout_account_type text := lower(btrim(coalesce(p_payout_account_type, '')));
  normalized_payout_account_last4 text := regexp_replace(coalesce(p_payout_account_last4, ''), '\D', '', 'g');
  normalized_payout_routing_last4 text := regexp_replace(coalesce(p_payout_routing_last4, ''), '\D', '', 'g');
  helper_consent_at timestamptz;
  helper_consent_platform text;
  helper_consent_version text;
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

  if normalized_payout_account_holder_name = '' then
    raise exception 'Payout account holder name is required';
  end if;

  if normalized_payout_bank_name = '' then
    raise exception 'Payout bank name is required';
  end if;

  if normalized_payout_account_type not in ('checking', 'savings') then
    raise exception 'Payout account type is required';
  end if;

  if normalized_payout_account_last4 !~ '^[0-9]{4}$' then
    raise exception 'Payout account last 4 must be exactly 4 digits';
  end if;

  if normalized_payout_routing_last4 !~ '^[0-9]{4}$' then
    raise exception 'Payout routing last 4 must be exactly 4 digits';
  end if;

  select worker_background_check_consent_at
    , worker_background_check_consent_platform
    , worker_background_check_consent_version
  into helper_consent_at
    , helper_consent_platform
    , helper_consent_version
  from public.profiles
  where id = current_user_id;

  if helper_consent_at is null
    or helper_consent_platform is null
    or helper_consent_version is null then
    raise exception 'Background check consent is required before submitting a helper profile';
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
    payout_account_holder_name,
    payout_bank_name,
    payout_account_type,
    payout_account_last4,
    payout_routing_last4,
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
    normalized_payout_account_holder_name,
    normalized_payout_bank_name,
    normalized_payout_account_type,
    normalized_payout_account_last4,
    normalized_payout_routing_last4,
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
    payout_account_holder_name = excluded.payout_account_holder_name,
    payout_bank_name = excluded.payout_bank_name,
    payout_account_type = excluded.payout_account_type,
    payout_account_last4 = excluded.payout_account_last4,
    payout_routing_last4 = excluded.payout_routing_last4,
    status = 'submitted',
    submitted_at = timezone('utc'::text, now()),
    reviewed_at = null,
    reviewed_by = null;

  return updated_profile;
end;
$$;

create or replace function public.staff_update_worker_access(
  p_worker_id uuid,
  p_worker_verified boolean,
  p_worker_disabled boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_worker public.profiles%rowtype;
  worker_background_check public.worker_background_checks%rowtype;
begin
  if current_user_id is null or not public.has_staff_access(current_user_id) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if p_worker_id is null then
    raise exception 'Worker id is required';
  end if;

  if p_worker_verified is null or p_worker_disabled is null then
    raise exception 'Worker access flags are required';
  end if;

  select *
  into worker_background_check
  from public.worker_background_checks
  where worker_id = p_worker_id;

  select *
  into updated_worker
  from public.profiles
  where id = p_worker_id
    and is_worker = true;

  if not found then
    raise exception 'Worker profile not found';
  end if;

  if p_worker_verified and not p_worker_disabled then
    if worker_background_check.worker_id is null then
      raise exception 'Worker background check must be submitted before approval';
    end if;

    if worker_background_check.submitted_at is null then
      raise exception 'Worker background check must be submitted before approval';
    end if;

    if updated_worker.worker_background_check_consent_at is null
      or updated_worker.worker_background_check_consent_platform is null
      or updated_worker.worker_background_check_consent_version is null then
      raise exception 'Worker consent is required before approval';
    end if;
  end if;

  update public.profiles
  set
    worker_verified = p_worker_verified,
    worker_disabled = p_worker_disabled,
    worker_status = case
      when exists (
        select 1
        from public.jobs
        where worker_id = p_worker_id
          and status in ('accepted', 'in_progress')
      ) then worker_status
      when p_worker_disabled or not p_worker_verified then 'offline'::public.worker_status
      else worker_status
    end
  where id = p_worker_id
    and is_worker = true
  returning * into updated_worker;

  if not found then
    raise exception 'Worker profile not found';
  end if;

  if p_worker_verified and not p_worker_disabled then
    update public.worker_background_checks
    set
      status = 'cleared',
      reviewed_at = timezone('utc'::text, now()),
      reviewed_by = current_user_id
    where worker_id = p_worker_id;
  end if;

  return updated_worker;
end;
$$;

revoke all on function public.staff_update_worker_access(uuid, boolean, boolean) from public;
grant execute on function public.staff_update_worker_access(uuid, boolean, boolean) to authenticated;
