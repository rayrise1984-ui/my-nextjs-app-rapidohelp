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
  "supabase/migrations/20260501163923_urbanclap_booking_spine.sql",
  "supabase/migrations/20260503000000_admin_auth_without_profile.sql",
  "supabase/migrations/20260504000000_admin_activity_audit_trail.sql",
].map(read);

const allMigrations = migrations.join("\n\n");

const latestTrustedActions = read(
  "supabase/migrations/20260427002000_trusted_marketplace_actions.sql",
);
const demoSeedScript = read("scripts/create-demo-users.cjs");
const webAuthPanel = read("apps/web/components/auth-panel.tsx");
const webLoginLinks = read("apps/web/components/login-links.tsx");
const webSiteFooter = read("apps/web/components/site-footer.tsx");
const webMiddleware = read("apps/web/utils/supabase/middleware.ts");
const webProfileGate = read("apps/web/components/profile-completion-gate.tsx");
const webAdminPage = read("apps/web/app/admin/page.tsx");
const webAdminRequestsPanel = read("apps/web/app/admin/_components/admin-requests-panel.tsx");
const webAdminHelper = read("apps/web/lib/admin.ts");
const webTermsPage = read("apps/web/app/terms/page.tsx");
const webPrivacyPage = read("apps/web/app/privacy/page.tsx");
const webLegalCopy = read("apps/web/lib/legal.ts");
const adminAuthWithoutProfile = read("supabase/migrations/20260503000000_admin_auth_without_profile.sql");
const activityAuditTrail = read("supabase/migrations/20260504000000_admin_activity_audit_trail.sql");
const privacyPolicyDoc = read("docs/legal/privacy-policy.md");
const magicLinkTemplate = read("supabase/templates/magic_link.html");
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
const urbanclapBookingSpine = read("supabase/migrations/20260501163923_urbanclap_booking_spine.sql");
const webDashboardPanel = read("apps/web/app/dashboard/_components/dashboard-panel.tsx");
const webJobDetailPanel = read("apps/web/app/dashboard/jobs/[jobId]/job-detail-panel.tsx");
const webWorkerPanel = read("apps/web/app/worker/_components/worker-panel.tsx");
const mobileDashboardScreen = read("apps/mobile/lib/screens/dashboard_screen.dart");
const mobileJobDetailScreen = read("apps/mobile/lib/screens/job_detail_screen.dart");
const mobileWorkerScreen = read("apps/mobile/lib/screens/worker_screen.dart");

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
    assert.match(config, /"io\.supabase\.flutter:\/\/signin-callback\/"/);
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
    assert.match(config, /\[auth\.email\.template\.magic_link\]/);
    assert.match(config, /content_path = "\.\/supabase\/templates\/magic_link\.html"/);
    assert.match(config, /subject = "Your RapidoHelp sign-in code"/);
    assert.match(magicLinkTemplate, /Your RapidoHelp sign-in code/);
    assert.match(magicLinkTemplate, /\{\{ \.Token \}\}/);
    assert.doesNotMatch(magicLinkTemplate, /\{\{ \.ConfirmationURL \}\}/);
  });
});

describe("Web login routing", () => {
  it("keeps admin sign-in private and profile-free", () => {
    assert.doesNotMatch(webLoginLinks, /Admin Sign In/);
    assert.match(webLoginLinks, /Customer Sign Up/);
    assert.match(webLoginLinks, /Service Partner Sign Up/);
    assert.match(webAuthPanel, /ADMIN_LOGIN_EMAIL/);
    assert.match(webAuthPanel, /Admin sign in\./);
    assert.match(webAuthPanel, /No profile setup is needed\./);
    assert.match(webAuthPanel, /Send email code/);
    assert.match(webAuthPanel, /Verify code/);
    assert.match(webAuthPanel, /Resend code/);
    assert.match(webAuthPanel, /type: "email"/);
    assert.match(webAuthPanel, /type: "sms"/);
    assert.doesNotMatch(webAuthPanel, /Send magic link/);
    assert.match(webAdminHelper, /helpdesk@rapidohelp\.com/);
    assert.match(webMiddleware, /isAdminEmail/);
    assert.doesNotMatch(webAdminPage, /ProfileCompletionGate|TermsAcceptanceGate/);
  });

  it("links the footer and policy pages to helpdesk contact and privacy details", () => {
    assert.match(webSiteFooter, /Contact us/);
    assert.match(webSiteFooter, /CONTACT_EMAIL/);
    assert.match(webSiteFooter, /Privacy Policy/);
    assert.match(webSiteFooter, /Terms of Service/);
    assert.match(webTermsPage, /CONTACT_EMAIL/);
    assert.match(webTermsPage, /Privacy Policy/);
    assert.match(webPrivacyPage, /CONTACT_EMAIL/);
    assert.match(webPrivacyPage, /privacySections/);
    assert.match(webLegalCopy, /privacySections/);
    assert.match(webLegalCopy, /Authorized staff and admins may review activity records/);
    assert.match(privacyPolicyDoc, /Internal Access and Activity Review/);
    assert.match(privacyPolicyDoc, /helpdesk@rapidohelp\.com/);
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

  it("creates a helpdesk admin seed for the admin sign-in path", () => {
    assert.match(demoSeedScript, /email: process\.env\.SMTP_ADMIN_EMAIL \|\| 'helpdesk@rapidohelp\.com'/);
    assert.match(demoSeedScript, /fullName: 'Helpdesk Admin'/);
    assert.match(demoSeedScript, /role: 'admin'/);
    assert.match(demoSeedScript, /if \(demoUser\.role === 'admin'\) {\s*return;\s*}/s);
  });
});

describe("Admin auth without profile", () => {
  it("lets the admin account authenticate from email alone", () => {
    assert.match(
      adminAuthWithoutProfile,
      /if lower\(coalesce\(new\.email, ''\)\) = 'helpdesk@rapidohelp\.com' then/,
    );
    assert.match(adminAuthWithoutProfile, /from auth\.users/);
    assert.match(adminAuthWithoutProfile, /lower\(email\) = 'helpdesk@rapidohelp\.com'/);
    assert.match(adminAuthWithoutProfile, /role in \('agent', 'admin'\)/);
  });
});

describe("Admin activity visibility", () => {
  it("surfaces support requests and a combined activity feed for staff", () => {
    assert.match(webAdminPage, /Review jobs, support requests/);
    assert.match(webAdminRequestsPanel, /Support inbox/);
    assert.match(webAdminRequestsPanel, /Activity feed/);
    assert.match(webAdminRequestsPanel, /Audit trail/);
    assert.match(webAdminRequestsPanel, /open support requests/);
    assert.match(webAdminRequestsPanel, /support_requests/);
    assert.match(webAdminRequestsPanel, /support_request_comments/);
    assert.match(webAdminRequestsPanel, /activity_events/);
    assert.match(webAdminRequestsPanel, /Every booking, support request, profile update/);
    assert.match(activityAuditTrail, /create table if not exists public\.activity_events/);
    assert.match(activityAuditTrail, /Staff can read activity events/);
    assert.match(activityAuditTrail, /create or replace function public\.record_activity_event\(\)/);
    assert.match(activityAuditTrail, /log_job_activity/);
    assert.match(activityAuditTrail, /log_profile_activity/);
    assert.match(activityAuditTrail, /log_support_request_activity/);
    assert.match(activityAuditTrail, /log_background_check_activity/);
  });
});

describe("Mobile OTP auth", () => {
  it("signs customers and helpers in with email or SMS codes", () => {
    assert.match(mobileMain, /Email code sent\. Enter it below to sign in\./);
    assert.match(mobileMain, /Send email code/);
    assert.match(mobileMain, /Verify code/);
    assert.match(mobileMain, /OtpType\.email/);
    assert.match(mobileMain, /OtpType\.sms/);
    assert.match(mobileMain, /Phone login uses SMS OTP\./);
    assert.match(mobileMain, /Email login uses OTP codes\./);
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

describe("UrbanClap booking spine", () => {
  it("stores the booking address, schedule, preferred partner, and payment choice on each job", () => {
    assert.match(urbanclapBookingSpine, /add column if not exists service_address text/);
    assert.match(urbanclapBookingSpine, /add column if not exists scheduled_for timestamptz/);
    assert.match(urbanclapBookingSpine, /add column if not exists preferred_worker_id uuid references auth\.users\(id\) on delete set null/);
    assert.match(urbanclapBookingSpine, /add column if not exists booking_payment_method text/);
    assert.match(urbanclapBookingSpine, /jobs_booking_payment_method_check/);
    assert.match(urbanclapBookingSpine, /jobs_scheduled_for/);
    assert.match(urbanclapBookingSpine, /jobs_preferred_worker_id/);
    assert.match(urbanclapBookingSpine, /create or replace function public\.offer_preferred_worker_for_job\(\)/);
    assert.match(urbanclapBookingSpine, /Service address is required/);
    assert.match(urbanclapBookingSpine, /Scheduled time is required/);
    assert.match(urbanclapBookingSpine, /Booking payment method is required/);
    assert.match(urbanclapBookingSpine, /Preferred service partner is not available/);
    assert.match(urbanclapBookingSpine, /Preferred service partner does not support this service/);
    assert.match(urbanclapBookingSpine, /insert into public\.job_assignments \(job_id, worker_id, status, offered_at\)/);
  });

  it("surfaces the booking spine in the customer and worker web flows", () => {
    for (const phrase of [
      "Preferred service partner",
      "Service address",
      "Schedule your service",
      "Booking payment preference",
      "Mark paid cash",
    ]) {
      assert.match(webDashboardPanel, new RegExp(phrase));
    }

    for (const phrase of [
      "Offered to you",
      "Preferred for you",
      "Address:",
      "When:",
      "Payment:",
    ]) {
      assert.match(webWorkerPanel, new RegExp(phrase));
    }

    for (const phrase of [
      "service_address",
      "booking_payment_method",
      "Mark paid cash",
      "Preferred partner requested",
    ]) {
      assert.match(webJobDetailPanel, new RegExp(phrase));
    }

    for (const phrase of [
      "Service address",
      "Schedule your service",
      "Booking payment preference",
      "booking_payment_method",
      "Address:",
      "When:",
    ]) {
      assert.match(mobileDashboardScreen, new RegExp(phrase));
    }

    for (const phrase of [
      "serviceAddress",
      "scheduledFor",
      "bookingPaymentMethod",
      "Mark Paid Cash",
    ]) {
      assert.match(mobileJobDetailScreen, new RegExp(phrase));
    }

    for (const phrase of [
      "Offered to you",
      "Address:",
      "When:",
      "Payment:",
    ]) {
      assert.match(mobileWorkerScreen, new RegExp(phrase));
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
