# RapidoHelp – On-Demand Roadside Assistance Marketplace

**Instant help in minutes — anytime, anywhere**

This monorepo contains a full-stack MVP for a gig economy marketplace connecting users needing roadside assistance with verified local helpers.

## Platform Overview

- **Users** post roadside assistance jobs (flat tire, jump start, fuel delivery, towing)
- **Workers** view nearby job offers, accept them, and earn money
- **Real-time matching** connects users with helpers in 5–15 minutes
- **Transparent pricing** with commission-based revenue model
- **Ratings system** enables trust between users and workers

## Repository Layout

```text
apps/
  mobile/     Flutter app for iOS/Android (users and workers)
  web/        Next.js app for job booking and worker management
supabase/     Backend: auth, data, realtime, and RLS policies
docs/         Architecture and deployment guides
```

## Tech Stack

- **Frontend**: Next.js (web) + Flutter (mobile)
- **Backend**: Supabase (PostgreSQL, auth, realtime)
- **Maps & Locations**: Mock locations for MVP (test mode)
- **Payments**: Stripe ready (payment routing TBD)

## Prerequisites

- Node.js 20+, npm 10+
- Flutter stable
- Supabase CLI

*Note: These tools were not available when the repo was scaffolded. Commands below assume you install them first.*

## Development Setup

### 1. Web (Next.js)

```bash
cd apps/web
npm install
npm run dev
```

**Environment variables** (`apps/web/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Access:**
- `/` – Home with service cards and sign-in
- `/auth` – Magic link OTP sign-in
- `/dashboard` – User job booking and history
- `/worker` – Worker job feed (next step)
- `/admin` – Job management and worker verification (next step)

### 2. Mobile (Flutter)

```bash
cd apps/mobile
flutter create . --platforms=android,ios
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key
```

**App flow:**
- Sign in with email OTP
- Auto-navigate to request list (users) or job feed (workers)
- Post jobs or accept job offers
- Real-time updates

### 3. Supabase Backend

```bash
supabase start
supabase db reset
```

Then configure Supabase project site URL and redirect URIs for OAuth magic links.

For local Auth email delivery, configure SMTP in `supabase/config.toml` and put secrets in a root `.env` file. RapidoHelp uses the GoDaddy Microsoft 365 mailbox for auth email:

```bash
SMTP_HOST=smtp.office365.com
SMTP_USER=helpdesk@rapidohelp.com
SMTP_PASS=your-helpdesk-mailbox-password
SMTP_ADMIN_EMAIL=helpdesk@rapidohelp.com
```

Supabase sends through port `587` from `supabase/config.toml`; Microsoft 365 uses STARTTLS on that port.

Restart Supabase after SMTP changes:

```bash
supabase stop
supabase start
```

## Current Features (MVP)

**User Authentication**
- Supabase email magic-link OTP across web and mobile
- Session persistence with row-level security

**User Job Posting**
- Select service type (flat tire, jump start, fuel, towing)
- Describe situation
- Test mode: choose mock location (real GPS in production)
- Real-time job list with status badges

**Marketplace Schema**
- `jobs` – user-posted help requests
- `worker_profiles` – verify and manage workers (RLS: worker-only access)
- `job_assignments` – track worker offers and acceptance
- `worker_ratings` – customers rate completed jobs
- Realtime subscriptions on all tables

**Mobile Job Booking**
- Flutter request list matching exact web UX
- Post jobs, track active jobs, view history
- Realtime status updates

**Automated Test Coverage**
- Web marketplace/support helper tests via Node's built-in test runner
- Supabase migration/config contract tests for auth SMTP, RLS, RPC grants, and marketplace actions
- Flutter widget/model test cases for auth shell, service visuals, jobs, ratings, and payout helpers

## Planned Features (Next Steps)

1. **Worker Job Feed** – `/worker` route for authenticated workers
   - Browse nearby pending jobs (test: by mock location zones)
   - Accept/decline job offers
   - Navigate to job location with mock map

2. **Job Completion & Ratings**
   - Worker marks job complete
   - User rates worker 1–5 stars + optional comment
   - Worker ratings averaged and displayed

3. **Worker Earnings Dashboard**
   - Track total earnings
   - Commission breakdown (platform takes X%)
   - Payout history

4. **Admin Panel** (`/admin`)
   - View all jobs and workers
   - Verify/deactivate workers
   - Handle disputes
   - Analytics (jobs/day, revenue, etc.)

5. **Real GPS & Matching**
   - Replace mock locations with real user location via phone GPS
   - Improve matching to find nearest available workers

6. **Push Notifications**
   - Notify workers of nearby job offers
   - Notify users when worker accepts
   - Notify worker when job completed/rated

7. **Payments & Payouts**
   - Stripe integration for user payment
   - Worker payout processing

## Domain Model

### Key Tables

| Table | Purpose |
|-------|---------|
| `auth.users` | Supabase auth (email, session) |
| `profiles` | User profile, role, avatar |
| `jobs` (new) | Posted help requests with location & status |
| `job_assignments` (new) | Worker offers made, accepted, completed |
| `worker_ratings` (new) | User ratings of workers after job completion |

### Enum Types

- `service_type` – flat_tire, jump_start, fuel_delivery, towing
- `job_status` – pending, accepted, in_progress, completed, cancelled, cancelled_by_worker
- `worker_status` – offline, online, on_job

### Row Level Security (RLS)

- Users see only their own jobs
- Workers see job offers extended to them
- Workers see only their own ratings and earnings
- Admin sees all (role-based, next step)

## Configuration for Production

### Supabase Project Setup

1. Create Supabase project
2. Copy URL and anon key to `.env.local` (web) and `--dart-define` (mobile)
3. Configure **Auth → URL Configuration**:
   - Site URL: your production domain
   - Redirect URLs: `/auth/callback` on web, deep link on mobile
4. Run migrations: `supabase db reset`
5. (Optional) Configure Stripe webhook for payments

### Deployment

**Web (Vercel):**
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel deploy
```

**Mobile (App Store / Play Store):**
- Build signed APK/IPA
- Submit with app signing key and provisioning profiles

See `docs/deployment.md` for detailed setup steps.

## Marketplace Economics

**Revenue Model:**
- Commission: 20–30% of job price
- Surge pricing: +50% during peak hours
- Worker subscriptions: $4.99/month for priority visibility
- Ads: Workers pay to appear first in regional feeds

**Example:**
- User books $50 roadside help
- Platform takes 25% = $12.50
- Worker earns $37.50 (minus payment processor fees ~3%)
- 100 jobs/day × $12.50 = $1,250 platform revenue/day

## Team Roles

**User**: Posts jobs, pays for help, rates workers
**Worker**: Accepts jobs, completes work, earns money
**Admin**: Verifies workers, manages disputes, views analytics
**Developer**: Extends marketplace features, optimizes matching

## Recommended Startup Sequence

1. **Foundation** (completed)
   - Monorepo, auth, schema, home page

2. **Next: Worker Features** (in progress)
   - Create `/worker` route with job feed
   - Allow workers to accept/decline jobs
   - Build job detail screen with navigation to location

3. **Then: Completion & Ratings**
   - Worker marks job complete
   - User rates and comments
   - Compute worker rating averages

4. **Then: Admin Panel**
   - Create `/admin` dashboard
   - Worker verification flows
   - Basic analytics

5. **Then: Real Location Matching**
   - Integrate device GPS
   - Replace mock zones with real proximity matching
   - Improve worker recommendation algorithm

6. **Then: Payments**
   - Stripe integration
   - User payment processing
   - Worker payouts

## Code Organization

**Web**:
- `app/page.tsx` – Home with service overview
- `app/auth/page.tsx` – Sign-in page
- `app/dashboard/` – User job posting and history
- `app/worker/` – Worker job feed (next)
- `app/admin/` – Admin console (next)
- `lib/marketplace.ts` – Types and state helpers
- `lib/supabase.ts` – Client initialization

**Mobile**:
- `lib/models/support_models.dart` – Job and worker data classes (rename to `job_models.dart` next)
- `lib/screens/dashboard_screen.dart` – User job list
- `lib/screens/job_detail_screen.dart` – Job status detail + real-time updates
- `lib/core/supabase_config.dart` – Config

**Backend**:
- `supabase/migrations/20260320005000_pivot_to_marketplace.sql` – Full schema for jobs, workers, ratings
- RLS policies for marketplace access control

## Documentation

- `docs/architecture.md` – System design and boundaries
- `docs/deployment.md` – Production setup for web and mobile
- `.github/workflows/` – CI/CD stubs for automated testing and deployment

## Quick Start for Developers

1. Install Node, Flutter, Supabase CLI
2. `git clone` and `cd` to repo root
3. `supabase start`
4. `cd apps/web && npm install && npm run dev`
5. Open `http://localhost:3000` and sign in
6. Post a test job to see the marketplace in action

## Test Commands

```bash
npm test
npm run typecheck:web
npm run build:web
npm run test:mobile
```

`npm run test:mobile` requires Flutter on your PATH.

Questions? See `docs/architecture.md` for design decisions and `docs/deployment.md` for production readiness.

---

**Last Updated:** March 20, 2026  
**Current Phase:** MVP with user job posting and worker onboarding (next)
