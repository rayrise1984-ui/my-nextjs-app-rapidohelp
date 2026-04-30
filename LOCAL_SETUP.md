# RapidoHelp Local Development Setup

## Prerequisites
- Node.js 18+ (npm)
- Supabase CLI (`brew install supabase`)
- Flutter SDK 3.10+ (for mobile)
- Docker (for local Supabase)

## Quick Start (Web + Supabase)

### 1. Start Supabase Local Environment
```bash
cd /Users/naveenantil/Documents/rapidohelp
supabase start
```

### 2. Run schema migrations
```bash
supabase db reset
```

### 3. Install dependencies & start web dev server
```bash
cd apps/web
npm install
npm run dev
```

Visit: `http://localhost:3000`

## Test Flows

### User Job Booking
1. Go to `/dashboard`
2. Sign up with email
3. Fill job form (service type, description, location) 
4. Submit → See job in real-time list
5. Job status shows "pending"

### Worker Job Feed
1. Sign up as **different user**
2. Go to `/worker`
3. See pending jobs in "Available jobs" section
4. Click "Accept job" → Job moves to "Active jobs"
5. Mark complete → Job shows "completed"

### Job Ratings
1. After job is completed (worker marks done)
2. Return to user dashboard
3. See completed job with rating panel
4. Submit 5-star rating + optional comment
5. Rating saved to `worker_ratings` table

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` – From Supabase project
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Anon JWT
- `SUPABASE_SERVICE_ROLE_KEY` – Service role (for backend)
- `SMTP_HOST` – SMTP host for Supabase Auth email delivery, `smtp.office365.com`
- `SMTP_USER` – SMTP username, `helpdesk@rapidohelp.com`
- `SMTP_PASS` – the `helpdesk@rapidohelp.com` mailbox password
- `SMTP_ADMIN_EMAIL` – sender address, `helpdesk@rapidohelp.com`

The Supabase SMTP port is `587` in `supabase/config.toml`; Microsoft 365 uses STARTTLS on that port.

Supabase local config reads SMTP secrets from a root `.env` file through `env(...)` references in `supabase/config.toml`.
Create it from the example and fill in real SMTP values:

```bash
cp .env.example .env
```

Then restart Supabase after changing SMTP settings:

```bash
supabase stop
supabase start
```

For local email inspection without an external SMTP provider, Supabase Inbucket is available at `http://localhost:54324`.

## Flutter Mobile Setup
```bash
cd apps/mobile
flutter pub get
flutter run
```

## Automated Tests

```bash
npm test
```

Runs:
- Web marketplace/support unit tests
- Supabase migration/config contract tests

```bash
npm run typecheck:web
npm run build:web
```

Runs the Next.js typecheck and production build.

```bash
npm run test:mobile
```

Runs Flutter widget/model tests when the Flutter SDK is installed.

## Verify Setup
- [ ] Supabase local instance running (port 54321)
- [ ] Tables created: `jobs`, `job_assignments`, `worker_ratings`, `profiles`
- [ ] RLS policies enforced
- [ ] Realtime subscriptions working
- [ ] SMTP variables set in `.env` or local Inbucket verified
- [ ] Tests pass (`npm test`)
- [ ] Web app compiles (`npm run dev`)
- [ ] Mobile app compiles (`flutter run`)

## Troubleshooting
- **"Cannot find module"** → Run `npm install` in `apps/web`
- **Supabase won't start** → Check Docker running; run `supabase reset`
- **RLS errors** → Verify authenticated user in `profiles` table
- **Realtime not updating** → Check browser console for connection errors

## Debugging
- Supabase Studio: `http://localhost:54321` (local)
- Next.js dev tools: `http://localhost:3000` (web)
- Flutter DevTools: `flutter run` will show URL

---

**Next Steps:**
1. Run `supabase start` and `supabase db reset`
2. Run `npm install` and `npm run dev` in `apps/web`
3. Test user job booking + worker acceptance flow
4. Verify realtime subscriptions in browser console
