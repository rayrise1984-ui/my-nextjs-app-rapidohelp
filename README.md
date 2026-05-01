# RapidoHelp – Customer, Service Partner, and Admin Marketplace

**Instant help in minutes — anytime, anywhere**

This monorepo contains a full-stack MVP for a marketplace connecting customers, service partners, and admins in one product flow.

## Platform Overview

- **Customers** post roadside assistance and local help jobs
- **Service partners** view nearby job offers, accept them, and earn money
- **Admins** review partners, manage access, and monitor operations
- **Real-time matching** connects customers with nearby service partners
- **Transparent pricing** with commission-based revenue model
- **Ratings system** enables trust between customers and service partners

## Repository Layout

```text
apps/
  mobile/     Flutter app for iOS/Android (customers and service partners)
  web/        Next.js app for booking, partner operations, and admin review
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
- `/` – Home with customer and service partner entry points
- `/auth` – Profile creation and sign-in
- `/dashboard` – Customer booking and history
- `/worker` – Service partner job feed and earnings
- `/admin` – Admin review and verification workspace

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
- Auto-navigate to request list (customers) or job feed (service partners)
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

**Customer Authentication**
- Supabase email magic-link OTP across web and mobile
- Session persistence with row-level security

**Customer Booking**
- Select service type and describe the request
- Add location details and schedule the visit
- Review pricing, payment, and status updates in real time

**Marketplace Schema**
- `profiles` – customer, service partner, and admin accounts
- `jobs` – user-posted help requests
- `job_assignments` – track service partner offers and acceptance
- `worker_background_checks` – partner verification and payout details
- `worker_ratings` – customers rate completed jobs
- Realtime subscriptions on all tables

**Mobile Booking and Partner Ops**
- Flutter request list matching exact web UX
- Customers post jobs, track active jobs, and view history
- Service partners review work, earnings, and approval state
- Realtime status updates

**Automated Test Coverage**
- Web marketplace/customer-service-partner tests via Node's built-in test runner
- Supabase migration/config contract tests for auth SMTP, RLS, RPC grants, and marketplace actions
- Flutter widget/model test cases for auth shell, service visuals, jobs, ratings, and payout helpers

## Planned Features (Next Steps)

1. **Service Partner Job Feed** – `/worker` route for authenticated service partners
   - Browse nearby pending jobs (test: by mock location zones)
   - Accept/decline job offers
   - Navigate to job location with mock map

2. **Job Completion & Ratings**
   - Service partner marks job complete
   - Customer rates service partner 1–5 stars + optional comment
   - Service partner ratings averaged and displayed

3. **Service Partner Earnings Dashboard**
   - Track total earnings
   - Commission breakdown (platform takes X%)
   - Payout history

4. **Admin Panel** (`/admin`)
   - View all jobs and service partners
   - Verify/deactivate service partners
   - Handle disputes
   - Analytics (jobs/day, revenue, etc.)

5. **Real GPS & Matching**
   - Replace mock locations with real user location via phone GPS
   - Improve matching to find nearest available service partners

6. **Push Notifications**
   - Notify service partners of nearby job offers
   - Notify customers when a service partner accepts
   - Notify service partner when job completed/rated

7. **Payments & Payouts**
   - Stripe integration for user payment
   - Service partner payout processing

## Domain Model

### Key Tables

| Table | Purpose |
|-------|---------|
| `auth.users` | Supabase auth (email, session) |
| `profiles` | User profile, role, avatar |
| `jobs` (new) | Posted help requests with location & status |
| `job_assignments` (new) | Service partner offers made, accepted, completed |
| `worker_ratings` (new) | Customer ratings of service partners after job completion |

### Enum Types

- `service_type` – flat_tire, jump_start, fuel_delivery, towing
- `job_status` – pending, accepted, in_progress, completed, cancelled, cancelled_by_worker
- `worker_status` – offline, online, on_job

### Row Level Security (RLS)

- Users see only their own jobs
- Service partners see job offers extended to them
- Service partners see only their own ratings and earnings
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
Set the Vercel project **Root Directory** to `apps/web`, then add the environment variables and deploy.

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
vercel env add NEXT_PUBLIC_SITE_URL
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

**Customer**: Posts jobs, pays for help, rates service partners
**Service Partner**: Accepts jobs, completes work, earns money
**Admin**: Verifies service partners, manages disputes, views analytics
**Developer**: Extends marketplace features, optimizes matching

## Recommended Startup Sequence

1. **Foundation** (completed)
   - Monorepo, auth, schema, home page

2. **Next: Service Partner Features** (in progress)
   - Create `/worker` route with job feed
   - Allow service partners to accept/decline jobs
   - Build job detail screen with navigation to location

3. **Then: Completion & Ratings**
   - Service partner marks job complete
   - User rates and comments
   - Compute worker rating averages

4. **Then: Admin Panel**
   - Create `/admin` dashboard
   - Service partner verification flows
   - Basic analytics

5. **Then: Real Location Matching**
   - Integrate device GPS
   - Replace mock zones with real proximity matching
   - Improve worker recommendation algorithm

6. **Then: Payments**
   - Stripe integration
   - User payment processing
   - Service partner payouts

## Code Organization

**Web**:
- `app/page.tsx` – Home with service overview
- `app/auth/page.tsx` – Sign-in page
- `app/dashboard/` – User job posting and history
- `app/worker/` – Service partner job feed (next)
- `app/admin/` – Admin console (next)
- `lib/marketplace.ts` – Types and state helpers
- `lib/supabase.ts` – Client initialization

**Mobile**:
- `lib/models/support_models.dart` – Job and worker data classes (rename to `job_models.dart` next)
- `lib/screens/dashboard_screen.dart` – User job list
- `lib/screens/job_detail_screen.dart` – Job status detail + real-time updates
- `lib/core/supabase_config.dart` – Config

**Backend**:
- `supabase/migrations/20260320005000_pivot_to_marketplace.sql` – Full schema for jobs, service partners, ratings
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
