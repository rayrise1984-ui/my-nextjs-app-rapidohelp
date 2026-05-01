# Test Cases

## Web Customer Flow

- Unauthenticated users visiting `/dashboard` or job detail are redirected to `/auth`.
- Signed-in users must complete their profile before dashboard access opens.
- A signed-in customer can post a job with service type, description, estimate, and mock location.
- Empty descriptions and invalid estimates are rejected before insert.
- New customer jobs appear in newest-first order.
- A pending customer job can be cancelled through `cancel_job`.
- A completed job shows payment actions and can be marked paid through `mark_job_paid`.
- A completed assigned job can be rated through `rate_worker`.

## Web Worker Flow

- A worker must complete profile, background check, and payout account details before seeing intake.
- A worker cannot go online or accept work until staff verification is active.
- A verified worker can filter available jobs by selected services.
- A verified online worker can accept only matching pending jobs.
- Accepted jobs can move to in-progress through `start_job`.
- Active jobs can be cancelled through `cancel_worker_job`.
- In-progress jobs can be completed with a positive final price through `complete_job`.
- Worker profiles show work history with paid earnings and pending payout totals.
- Completed work can export a worker waybill.

## Web Admin Flow

- Customers visiting `/admin` are redirected back to `/dashboard`.
- Staff can view all jobs and worker profiles.
- Staff can approve or pause worker access through `staff_update_worker_access`.
- Staff can update job statuses through `staff_update_job_status`.
- Admin metrics reflect open, active, completed, worker-review, and gross-value counts.

## Supabase Backend

- `prepare_job_insert` owns jobs with `auth.uid()` and resets protected job fields on insert.
- RLS is enabled for `profiles`, `jobs`, `job_assignments`, and `worker_ratings`.
- Customer, worker, and staff read/write policies match the marketplace roles.
- Trusted RPCs are revoked from `public` and granted only to `authenticated`.
- Worker acceptance requires a completed, verified, enabled, online worker profile with matching service types.
- Payment and rating RPCs can only be performed by the owning customer after completion.
- Rating and earnings summary triggers keep `profiles` aggregates current.
- SQL, web, and mobile service catalogs remain aligned.

## Mobile Flow

- The app renders the auth shell when Supabase config is missing.
- Signed-in users must complete their profile before the dashboard or worker view opens.
- Auth UI switches between email/password and phone OTP modes.
- Job JSON maps database fields, defaults missing payment status to `unpaid`, and calculates payout fallbacks.
- Worker rating JSON maps all rating fields.
- RPC object helpers normalize direct object and single-row list responses.
- Worker onboarding requires background check and payout account details before profile completion.
- Worker profile screens show work history and earnings totals after onboarding.
- Mobile service visuals cover every marketplace service type and fall back to `Others` for unknown values.
