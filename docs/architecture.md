# Architecture

## Goal

RapidoHelp is organized like an UrbanClap-style marketplace with three major systems:

1. Customer System
2. Service Partner System
3. Admin System

The current repo implements those three systems in a single monorepo with Next.js, Flutter, and Supabase.

## Current Repo Map

- `apps/web`: customer, service partner, and admin browser experience
- `apps/mobile`: customer and service partner mobile experience
- `supabase/`: auth, database schema, row-level security, RPCs, and realtime rules
- `docs/`: product workflows, deployment notes, and test contracts

## Customer System

### User Flow

1. Register or log in
   - Name
   - Email OTP or phone number with OTP
   - Email, optional
   - Location permission
2. Browse services
   - Service categories
   - Price, rating, duration, and location filters
3. Open service details
   - Description
   - Price
   - Estimated time
   - Ratings and reviews
   - Available slots
4. Create a booking
   - Date and time
   - Address
   - Add-ons
   - Payment method
5. Pay
   - Card or wallet style payment flow
   - Order creation and verification
6. Track service execution
   - Status updates
   - Notifications
   - Live work progress
7. Rate the service partner
   - Star rating
   - Text review
   - Tip option

### Current Implementation Notes

- The live code uses Supabase `profiles` for account state and `jobs` for bookings.
- Customer job posting, history, and rating are already wired in the web and mobile clients.

## Service Partner System

### User Flow

1. Register
   - Name
   - Email OTP or phone OTP
   - Email
   - Skills or service selections
   - Experience
   - Address
   - Identity documents
   - Background-check consent
   - Bank or payout details
2. Submit for review
   - Documents stored securely
   - Admin approval required before access
3. Use the partner dashboard
   - New jobs
   - Accepted jobs
   - Earnings
   - Ratings
   - Availability
4. Handle a job
   - Accept or reject
   - Navigate to the customer
   - Mark started
   - Mark completed
   - Upload proof if needed
5. Get paid
   - Commission calculation
   - Wallet balance
   - Payout history

### Current Implementation Notes

- The existing `/worker` route is the service partner workspace.
- Background-check consent, worker verification, payout details, earnings, and work history are already modeled in Supabase.
- Admin must set `worker_verified = true` before the partner can access the service flow.

## Admin System

### User Flow

1. Manage users
2. Review and approve service partners
3. Manage service categories and prices
4. Monitor bookings and job status
5. Handle complaints and disputes
6. Review payments and settlements
7. Track analytics and operations

### Current Implementation Notes

- The `/admin` route is the staff workspace.
- Admin can view service partner consent, verification state, earnings, and job history.

## Backend Architecture

### Stack

- Frontend: Next.js for web, Flutter for mobile
- Backend: Supabase Auth, Postgres, realtime, and RPCs
- Storage: Supabase storage or object storage for documents
- Notifications: email, SMS, and realtime updates

### What the repo already uses

- Supabase Auth for session handling
- Database triggers for profile bootstrap
- SQL functions and row-level security for trusted actions
- Realtime subscriptions for jobs and staff review screens

### Recommended backend boundaries

If the product grows beyond a single Supabase-backed monorepo, the same three-system split can be kept while moving business logic into dedicated API services:

1. Customer-facing APIs
2. Service partner APIs
3. Admin and operations APIs

## Database Schema

### Core Tables in the current repo

| Table | Purpose |
| --- | --- |
| `profiles` | User, customer, service partner, and admin account state |
| `jobs` | Customer bookings and service requests |
| `job_assignments` | Partner offers, acceptance, and completion history |
| `worker_background_checks` | Service partner consent, identity, address, and payout data |
| `worker_ratings` | Customer reviews of completed jobs |
| `support_requests` | Customer and staff support workflows |

### Common State Fields

- `role`
- `is_worker`
- `worker_verified`
- `worker_disabled`
- `worker_profile_completed`
- `worker_background_check_consent_at`
- `worker_background_check_consent_platform`
- `worker_background_check_consent_version`
- earnings and payout fields

## Complete System Flow

Customer:

`Register/Login -> Browse services -> Select service -> Choose slot -> Pay -> Booking created -> Partner assigned -> Service completed -> Rating`

Service Partner:

`Register -> Consent -> Upload documents -> Admin approval -> Go online -> Accept jobs -> Complete jobs -> Earnings and payout`

Admin:

`Manage users -> Review partners -> Approve documents -> Monitor bookings -> Handle complaints -> Analytics`

## Implementation Note

This repo already contains the main building blocks for the UrbanClap-style structure. The current work is mostly about aligning the product language, onboarding flow, and staff review screens with that model.
