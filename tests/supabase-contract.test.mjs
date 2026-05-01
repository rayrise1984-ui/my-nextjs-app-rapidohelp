import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");

const migrations = [
  "supabase/migrations/20260320000000_init.sql",
  "supabase/migrations/20260320002000_staff_roles.sql",
  "supabase/migrations/20260320005000_pivot_to_marketplace.sql",
  "supabase/migrations/20260320183500_add_gig_help_service_types.sql",
  "supabase/migrations/20260320190000_fix_marketplace_rls_and_job_owner.sql",
  "supabase/migrations/20260321161500_add_others_service_type.sql",
  "supabase/migrations/20260322080000_add_job_payment_fields.sql",
  "supabase/migrations/20260323090000_add_company_fee_and_worker_payout.sql",
  "supabase/migrations/20260427000000_harden_marketplace_for_production.sql",
  "supabase/migrations/20260427001000_add_home_care_service_types.sql",
  "supabase/migrations/20260427002000_trusted_marketplace_actions.sql",
  "supabase/migrations/20260427003000_customer_job_cancellation.sql",
  "supabase/migrations/20260427004000_worker_progress_and_matching.sql",
  "supabase/migrations/20260427005000_admin_worker_verification.sql",
  "supabase/migrations/20260429000000_add_terms_acceptance.sql",
  "supabase/migrations/20260430230843_worker_background_check_details.sql",
  "supabase/migrations/20260430235959_worker_payout_account_details.sql",
  "supabase/migrations/20260501000000_seed_profile_metadata_on_signup.sql",
  "supabase/migrations/20260502000000_helper_background_check_consent.sql",
].map(read);

const allMigrations = migrations.join("\n\n");

const latestTrustedActions = read(
  "supabase/migrations/20260427002000_trusted_marketplace_actions.sql",
);
const demoSeedScript = read("scripts/create-demo-users.cjs");
const webAuthPanel = read("apps/web/components/auth-panel.tsx");
const webMiddleware = read("apps/web/utils/supabase/middleware.ts");
const webProfileGate = read("apps/web/components/profile-completion-gate.tsx");
const mobileMain = read("apps/mobile/lib/main.dart");
const mobileProfileGate = read("apps/mobile/lib/screens/profile_completion_gate.dart");
const mobileProfileSetup = read("apps/mobile/lib/screens/profile_setup_screen.dart");
const mobileWorkerSetup = read("apps/mobile/lib/screens/worker_profile_setup_screen.dart");
const workerProgress = read(
  "supabase/migrations/20260427004000_worker_progress_and_matching.sql",
);
const workerVerification = read(
  "supabase/migrations/20260427005000_admin_worker_verification.sql",
);
const termsAcceptance = read(
  "supabase/migrations/20260429000000_add_terms_acceptance.sql",
);
const profileBootstrap = [
  read("supabase/migrations/20260320000000_init.sql"),
  read("supabase/migrations/20260501000000_seed_profile_metadata_on_signup.sql"),
  read("supabase/migrations/20260502000000_helper_background_check_consent.sql"),
].join("\n\n");
const workerBackgroundCheck = [
  read("supabase/migrations/20260430230843_worker_background_check_details.sql"),
  read("supabase/migrations/20260430235959_worker_payout_account_details.sql"),
  read("supabase/migrations/20260502000000_helper_background_check_consent.sql"),
].join("\n\n");

const expectSql = (sql, pattern, message) => {
  assert.match(sql.replace(/\s+/g, " "), pattern, message);
};

describe("Supabase auth and SMTP configuration", () => {
  const config = read("supabase/config.toml");

  it("enables local auth with web and mobile redirects", () => {
    expectSql(config, /\[auth\].*enabled = true/, "auth should be enabled");
    assert.match(config, /site_url = "http:\/\/localhost:3000"/);
    assert.match(config, /"http:\/\/localhost:3000\/auth"/);
    assert.match(config, /"http:\/\/localhost:3000\/dashboard"/);
    assert.match(config, /"http:\/\/localhost:3000\/worker"/);
    assert.match(config, /"rapidohelp:\/\/auth"/);
  });

  it("uses environment variables for SMTP secrets", () => {
    assert.match(config, /\[auth\.email\.smtp\]/);
    assert.match(config, /host = "env\(SMTP_HOST\)"/);
    assert.match(config, /port = 587/);
    assert.match(config, /user = "env\(SMTP_USER\)"/);
    assert.match(config, /pass = "env\(SMTP_PASS\)"/);
    assert.match(config, /admin_email = "env\(SMTP_ADMIN_EMAIL\)"/);
    assert.doesNotMatch(config, /SMTP_PASS=|your-smtp-password/);
  });
});

describe("Supabase profile bootstrap", () => {
  it("creates a profile row from auth metadata on signup", () => {
    assert.match(profileBootstrap, /create or replace function public\.handle_new_user\(\)/);
    expectSql(
      profileBootstrap,
      /insert into public\.profiles \(\s*id, full_name, role, is_worker, worker_background_check_consent_at, worker_background_check_consent_platform, worker_background_check_consent_version\s*\)/,
    );
    assert.match(profileBootstrap, /new\.raw_user_meta_data ->> 'full_name'/);
    assert.match(profileBootstrap, /new\.raw_user_meta_data ->> 'role'/);
    assert.match(profileBootstrap, /new\.raw_user_meta_data ->> 'is_worker'/);
    assert.match(profileBootstrap, /new\.raw_user_meta_data ->> 'worker_background_check_consent'/);
    assert.match(profileBootstrap, /new\.raw_user_meta_data ->> 'worker_background_check_consent_platform'/);
    assert.match(profileBootstrap, /new\.raw_user_meta_data ->> 'worker_background_check_consent_version'/);
  });
});

describe("Demo worker SMTP bootstrap", () => {
  it("prefers SMTP mailbox credentials for the worker seed and avoids logging the secret", () => {
    assert.match(
      demoSeedScript,
      /process\.env\.SMTP_USER \|\| process\.env\.DEV_WORKER_EMAIL \|\| 'helpdesk@rapidohelp\.com'/,
    );
    assert.match(
      demoSeedScript,
      /process\.env\.SMTP_PASS \|\| process\.env\.DEV_WORKER_PASSWORD \|\| DEMO_PASSWORD/,
    );
    assert.match(demoSeedScript, /loadEnvFile\(path\.join\(__dirname, '\.\.', '\.env'\)\)/);
    assert.match(demoSeedScript, /loadEnvFile\(path\.join\(__dirname, '\.\.', '\.env\.local'\)\)/);
    assert.match(demoSeedScript, /password from \$\{passwordSource\}/);
    assert.doesNotMatch(demoSeedScript, /ready:[^`]*:\$\{DEMO_PASSWORD\}/);
  });
});

describe("Supabase marketplace schema contracts", () => {
  it("creates and protects the core marketplace tables", () => {
    for (const table of ["profiles", "jobs", "job_assignments", "worker_ratings", "worker_background_checks"]) {
      assert.match(allMigrations, new RegExp(`(?:create table|alter table) (?:if not exists )?public?\\.?${table}|alter table ${table}`, "i"));
      assert.match(allMigrations, new RegExp(`alter table (?:public\\.)?${table} enable row level security`, "i"));
    }
  });

  it("keeps the SQL, web, and mobile service catalogs aligned", () => {
    const webCatalog = read("apps/web/lib/marketplace.ts");
    const mobileCatalog = read("apps/mobile/lib/core/service_visuals.dart");
    const serviceTypes = [
      "flat_tire",
      "jump_start",
      "fuel_delivery",
      "towing",
      "moving_help",
      "handyman_help",
      "plumbing_help",
      "electrical_help",
      "cna_support",
      "senior_helper",
      "cleaning_help",
      "delivery_help",
      "pet_help",
      "tech_help",
      "others",
    ];

    for (const serviceType of serviceTypes) {
      assert.match(webCatalog, new RegExp(`['"]${serviceType}['"]`));
      assert.match(mobileCatalog, new RegExp(`['"]${serviceType}['"]`));
      assert.match(allMigrations, new RegExp(`['"]${serviceType}['"]`));
    }
  });
});

describe("Supabase trusted marketplace actions", () => {
  it("normalizes customer job inserts in the database", () => {
    expectSql(latestTrustedActions, /create or replace function public\.prepare_job_insert\(\).*new\.user_id = current_user_id/, "jobs should be owned by auth.uid()");
    assert.match(latestTrustedActions, /new\.worker_id = null/);
    assert.match(latestTrustedActions, /new\.status = 'pending'/);
    assert.match(latestTrustedActions, /new\.payment_status = 'unpaid'/);
    assert.match(latestTrustedActions, /create trigger prepare_job_insert/);
  });

  it("prevents customers from mutating protected profile fields", () => {
    expectSql(workerBackgroundCheck, /create or replace function public\.protect_profile_sensitive_fields\(\).*not public\.has_staff_access/, "profile protection trigger should check staff access");
    for (const field of [
      "role",
      "is_worker",
      "worker_rating_avg",
      "worker_rating_count",
      "total_earnings",
      "worker_verified",
      "worker_disabled",
      "terms_accepted_at",
      "terms_version",
      "terms_acceptance_method",
      "terms_accepted_platform",
      "worker_background_check_consent_at",
      "worker_background_check_consent_platform",
      "worker_background_check_consent_version",
      "worker_profile_completed",
    ]) {
      assert.match(workerBackgroundCheck, new RegExp(`new\\.${field} = old\\.${field}`));
    }
  });

  it("keeps worker background check details private and submitted through an RPC", () => {
    assert.match(workerBackgroundCheck, /create table if not exists public\.worker_background_checks/);
    assert.match(workerBackgroundCheck, /ssn_last4 ~ '\^\[0-9\]\{4\}\$'/);
    assert.match(workerBackgroundCheck, /alter table public\.worker_background_checks enable row level security/);
    assert.match(workerBackgroundCheck, /Workers can read their own background check/);
    assert.match(workerBackgroundCheck, /Staff can read worker background checks/);
    for (const field of [
      "payout_account_holder_name",
      "payout_bank_name",
      "payout_account_type",
      "payout_account_last4",
      "payout_routing_last4",
      "worker_background_check_consent_at",
      "worker_background_check_consent_platform",
      "worker_background_check_consent_version",
    ]) {
      assert.match(workerBackgroundCheck, new RegExp(`add column if not exists ${field}`));
    }
    assert.match(workerBackgroundCheck, /worker_background_checks_payout_account_type_check/);
    assert.match(workerBackgroundCheck, /worker_background_checks_payout_account_last4_check/);
    assert.match(workerBackgroundCheck, /worker_background_checks_payout_routing_last4_check/);
    assert.match(workerBackgroundCheck, /sync_worker_profile_completion_from_background_check/);
    assert.match(workerBackgroundCheck, /worker_profile_completed = worker_complete/);
    assert.match(workerBackgroundCheck, /create or replace function public\.accept_worker_background_check_consent/);
    assert.match(workerBackgroundCheck, /set_config\('app\.accepting_worker_background_check', 'true', true\)/);
    assert.match(workerBackgroundCheck, /worker_background_check_consent_at = timezone\('utc'::text, now\(\)\)/);
    assert.match(workerBackgroundCheck, /worker_background_check_consent_platform = normalized_platform/);
    assert.match(workerBackgroundCheck, /worker_background_check_consent_version = normalized_version/);
    assert.match(workerBackgroundCheck, /is_worker_user\(check_user_id uuid default auth\.uid\(\)\)/);
    assert.match(workerBackgroundCheck, /Background check consent is required before submitting a helper profile/);
    assert.match(workerBackgroundCheck, /worker_profile_completed = true/);
    assert.match(workerBackgroundCheck, /create or replace function public\.submit_worker_profile/);
    assert.match(workerBackgroundCheck, /p_payout_account_holder_name text/);
    assert.match(workerBackgroundCheck, /worker_background_check_consent_at is null/);
    assert.match(workerBackgroundCheck, /helper_consent_platform is null/);
    assert.match(workerBackgroundCheck, /helper_consent_version is null/);
    assert.match(workerBackgroundCheck, /set_config\('app\.submitting_worker_profile', 'true', true\)/);
    assert.match(workerBackgroundCheck, /insert into public\.worker_background_checks/);
    assert.match(workerBackgroundCheck, /create or replace function public\.staff_update_worker_access/);
    assert.match(workerBackgroundCheck, /Worker consent is required before approval/);
    assert.match(workerBackgroundCheck, /create or replace function public\.is_worker_user\(check_user_id uuid default auth\.uid\(\)\)/);
    assert.match(workerBackgroundCheck, /worker_background_check_consent_at is not null/);
    assert.match(workerBackgroundCheck, /worker_background_check_consent_platform is not null/);
    assert.match(workerBackgroundCheck, /worker_background_check_consent_version is not null/);
    assert.match(workerBackgroundCheck, /worker_verified = true/);
    assert.match(workerBackgroundCheck, /worker_disabled = false/);
  });

  it("records terms acceptance with server-side timestamp and version", () => {
    for (const field of [
      "terms_accepted_at",
      "terms_version",
      "terms_acceptance_method",
      "terms_accepted_platform",
    ]) {
      assert.match(termsAcceptance, new RegExp(`add column if not exists ${field}`));
    }
    assert.match(termsAcceptance, /create or replace function public\.accept_terms/);
    assert.match(termsAcceptance, /terms_accepted_at = now\(\)/);
    assert.match(termsAcceptance, /terms_version = btrim\(p_terms_version\)/);
    assert.match(termsAcceptance, /terms_acceptance_method = 'clickwrap'/);
    assert.match(termsAcceptance, /p_platform not in \('web', 'mobile'\)/);
  });

  it("requires verified online workers with matching services before accepting jobs", () => {
    expectSql(workerVerification, /create or replace function public\.accept_job\(p_job_id uuid\).*worker_profile_completed = true/, "accept_job should require completed profile");
    assert.match(workerVerification, /worker_profile\.worker_disabled/);
    assert.match(workerVerification, /not worker_profile\.worker_verified/);
    assert.match(workerVerification, /worker_status is distinct from 'online'::public\.worker_status/);
    assert.match(workerVerification, /target_job\.service_type = any/);
    assert.match(workerVerification, /set worker_status = 'on_job'/);
  });

  it("covers worker progress, cancellation, and completion RPCs", () => {
    for (const rpc of ["accept_job", "start_job", "cancel_worker_job", "complete_job"]) {
      assert.match(workerProgress + workerVerification, new RegExp(`create or replace function public\\.${rpc}\\(`));
    }
    assert.match(workerProgress, /status = 'in_progress'/);
    assert.match(workerProgress, /status = 'cancelled_by_worker'/);
    assert.match(workerProgress, /status = 'completed'/);
    assert.match(workerProgress, /from public\.calculate_marketplace_payout/);
  });

  it("requires helper background-check consent before signup and profile completion", () => {
    assert.match(webAuthPanel, /worker_background_check_consent/);
    assert.match(webAuthPanel, /consent to a background check/);
    assert.match(webAuthPanel, /worker_verified/);
    assert.match(webAuthPanel, /worker_disabled/);
    assert.match(webMiddleware, /worker_verified/);
    assert.match(webMiddleware, /worker_disabled/);
    assert.match(webProfileGate, /accept_worker_background_check_consent/);
    assert.match(webProfileGate, /worker_background_check_consent_version/);
    assert.match(webProfileGate, /worker_verified/);
    assert.match(webProfileGate, /worker_disabled/);
    assert.match(mobileMain, /worker_background_check_consent/);
    assert.match(mobileMain, /consent to a background check/);
    assert.match(mobileProfileGate, /worker_background_check_consent_version/);
    assert.match(mobileProfileGate, /worker_verified/);
    assert.match(mobileProfileGate, /worker_disabled/);
    assert.match(mobileProfileSetup, /accept_worker_background_check_consent/);
    assert.match(mobileWorkerSetup, /accept_worker_background_check_consent/);
  });

  it("covers customer cancellation, payment, and rating RPCs", () => {
    const cancellation = read("supabase/migrations/20260427003000_customer_job_cancellation.sql");
    assert.match(cancellation, /create or replace function public\.cancel_job\(p_job_id uuid\)/);
    assert.match(cancellation, /and user_id = current_user_id/);
    assert.match(cancellation, /and status = 'pending'/);

    assert.match(latestTrustedActions, /create or replace function public\.mark_job_paid/);
    assert.match(latestTrustedActions, /p_method not in \('card', 'upi', 'cash'\)/);
    assert.match(latestTrustedActions, /payment_status = 'paid'/);
    assert.match(latestTrustedActions, /payment_reference = 'PAY-'/);

    assert.match(latestTrustedActions, /create or replace function public\.rate_worker/);
    assert.match(latestTrustedActions, /p_rating < 1 or p_rating > 5/);
    assert.match(latestTrustedActions, /on conflict \(job_id, from_user_id\)/);
  });

  it("exposes only intended RPCs to authenticated clients", () => {
    for (const signature of [
      "accept_job\\(uuid\\)",
      "complete_job\\(uuid, numeric\\)",
      "mark_job_paid\\(uuid, text\\)",
      "rate_worker\\(uuid, integer, text\\)",
      "staff_update_job_status\\(uuid, public\\.job_status\\)",
      "start_job\\(uuid\\)",
      "cancel_worker_job\\(uuid\\)",
      "cancel_job\\(uuid\\)",
      "staff_update_worker_access\\(uuid, boolean, boolean\\)",
      "accept_worker_background_check_consent\\(text, text\\)",
      "accept_terms\\(text, text\\)",
      "submit_worker_profile\\(public\\.worker_status, text, integer, public\\.service_type\\[\\], text, text, text, text, text, text, text, text, text, text, text, text, text, text\\)",
    ]) {
      expectSql(allMigrations, new RegExp(`revoke all on function public\\.${signature} from public`));
      expectSql(allMigrations, new RegExp(`grant execute on function public\\.${signature} to authenticated`));
    }
  });
});
