alter table public.worker_background_checks
  add column if not exists payout_account_holder_name text,
  add column if not exists payout_bank_name text,
  add column if not exists payout_account_type text,
  add column if not exists payout_account_last4 text,
  add column if not exists payout_routing_last4 text;

do $$
begin
  alter table public.worker_background_checks
    add constraint worker_background_checks_payout_account_type_check
    check (payout_account_type is null or payout_account_type in ('checking', 'savings'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.worker_background_checks
    add constraint worker_background_checks_payout_account_last4_check
    check (payout_account_last4 is null or payout_account_last4 ~ '^[0-9]{4}$');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.worker_background_checks
    add constraint worker_background_checks_payout_routing_last4_check
    check (payout_routing_last4 is null or payout_routing_last4 ~ '^[0-9]{4}$');
exception when duplicate_object then
  null;
end $$;

create or replace function public.sync_worker_profile_completion_from_background_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  worker_id uuid;
  worker_complete boolean := false;
begin
  if tg_op = 'DELETE' then
    worker_id := old.worker_id;
  else
    worker_id := new.worker_id;
  end if;

  if tg_op <> 'DELETE' then
    worker_complete :=
      btrim(coalesce(new.legal_full_name, '')) <> ''
      and new.ssn_last4 ~ '^[0-9]{4}$'
      and btrim(coalesce(new.driver_license_number, '')) <> ''
      and new.driver_license_state ~ '^[A-Z]{2}$'
      and btrim(coalesce(new.legal_address_line1, '')) <> ''
      and btrim(coalesce(new.legal_city, '')) <> ''
      and new.legal_state ~ '^[A-Z]{2}$'
      and btrim(coalesce(new.legal_postal_code, '')) <> ''
      and btrim(coalesce(new.payout_account_holder_name, '')) <> ''
      and btrim(coalesce(new.payout_bank_name, '')) <> ''
      and lower(btrim(coalesce(new.payout_account_type, ''))) in ('checking', 'savings')
      and new.payout_account_last4 ~ '^[0-9]{4}$'
      and new.payout_routing_last4 ~ '^[0-9]{4}$';
  end if;

  update public.profiles
  set worker_profile_completed = worker_complete
  where id = worker_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_worker_profile_completion on public.worker_background_checks;
create trigger sync_worker_profile_completion
  after insert or update or delete on public.worker_background_checks
  for each row execute procedure public.sync_worker_profile_completion_from_background_check();

update public.profiles as profile
set worker_profile_completed = exists (
  select 1
  from public.worker_background_checks background_check
  where background_check.worker_id = profile.id
    and btrim(coalesce(background_check.legal_full_name, '')) <> ''
    and background_check.ssn_last4 ~ '^[0-9]{4}$'
    and btrim(coalesce(background_check.driver_license_number, '')) <> ''
    and background_check.driver_license_state ~ '^[A-Z]{2}$'
    and btrim(coalesce(background_check.legal_address_line1, '')) <> ''
    and btrim(coalesce(background_check.legal_city, '')) <> ''
    and background_check.legal_state ~ '^[A-Z]{2}$'
    and btrim(coalesce(background_check.legal_postal_code, '')) <> ''
    and btrim(coalesce(background_check.payout_account_holder_name, '')) <> ''
    and btrim(coalesce(background_check.payout_bank_name, '')) <> ''
    and lower(btrim(coalesce(background_check.payout_account_type, ''))) in ('checking', 'savings')
    and background_check.payout_account_last4 ~ '^[0-9]{4}$'
    and background_check.payout_routing_last4 ~ '^[0-9]{4}$'
)
where profile.is_worker = true;

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
  );
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
    raise exception 'Payout account type must be checking or savings';
  end if;

  if normalized_payout_account_last4 !~ '^[0-9]{4}$' then
    raise exception 'Payout account last 4 must be exactly 4 digits';
  end if;

  if normalized_payout_routing_last4 !~ '^[0-9]{4}$' then
    raise exception 'Payout routing last 4 must be exactly 4 digits';
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

  select * into updated_profile
  from public.profiles
  where id = current_user_id;

  return updated_profile;
end;
$$;

drop function if exists public.submit_worker_profile(public.worker_status, text, integer, public.service_type[], text, text, text, text, text, text, text, text, text);

revoke all on function public.submit_worker_profile(public.worker_status, text, integer, public.service_type[], text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;

grant execute on function public.submit_worker_profile(public.worker_status, text, integer, public.service_type[], text, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
