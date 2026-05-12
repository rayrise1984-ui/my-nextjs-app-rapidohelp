# RapidoHelp - Complete Workflow Analysis

**Document Generated:** May 11, 2026

---

## 1. AUTHENTICATION & ACCOUNT CREATION FLOW

### 1.1 Customer Sign-Up Flow
```
Start: User visits / (Home) → Clicks "Book Help"
  ↓
Navigate to /auth?account=customer&mode=create
  ↓
Display Auth Panel with options:
  • Email OTP (default)
  • Phone OTP (alternative)
  • Password signup (admin only)
  ↓
If Email OTP:
  • User enters email
  • System sends OTP code to email
  • User enters 6-digit code
  • Supabase auth.signUp() with email/password
  • Session created with auth.uid()
  ↓
Redirect to /dashboard (ProfileCompletionGate intercepts)
  ↓
Profile Completion Gate Check:
  • Query profiles table for full_name
  • If empty → Show profile form
  • User fills: full_name, avatar_url
  • On submit → Update profiles.full_name
  ↓
If is_worker=false (customer):
  • Skip worker consent check
  • Skip background check requirement
  • Display TermsAcceptanceGate (accept T&C)
  ↓
Load Dashboard ✅
```

### 1.2 Worker/Service Partner Sign-Up Flow
```
Start: User visits / → Clicks "Earn Money"
  ↓
Navigate to /auth?account=helper&mode=create
  ↓
Display Auth Panel with fields:
  • Email OTP
  • Full Name
  • Background Check Consent checkbox
  ↓
User accepts consent → Stores consent:
  • worker_background_check_consent_at = now
  • worker_background_check_consent_platform = 'web'
  • worker_background_check_consent_version = 'helper_background_check_v1'
  ↓
Session created (auth.uid)
  ↓
Redirect to /worker (ProfileCompletionGate intercepts)
  ↓
Profile Completion Gate Check:
  • Check: is_worker = true
  • Check: worker_background_check_consent_at exists (✓)
  • Check: worker_verified = true (by admin) ✗
  • Check: worker_disabled = false (✗)
  ↓
Since not verified yet:
  • needsWorkerApproval = true
  • Show: "Your account is under review. Admin must approve."
  • Display form to complete profile:
    - Full name
    - Service types (multi-select)
    - Experience years
    - Work details/description
  ↓
User fills and saves profile
  ↓
ProfileCompletionGate shows: "Waiting for admin approval"
  ↓
Admin approves in /admin:
  • View worker in queue
  • Verify background check documents
  • Set worker_verified = true
  ↓
Worker now sees /worker dashboard ✅
```

### 1.3 Admin Sign-In Flow
```
Start: User visits /auth?account=admin
  ↓
Auth Panel shows email/password fields
  • Pre-fills email: helpdesk@rapidohelp.com
  • User enters password
  ↓
Supabase signInWithPassword()
  ↓
AdminPanel checks: isAdminEmail(session.user.email)
  ↓
If admin email NOT found:
  • Redirect from /admin back to /dashboard
  ↓
If admin email FOUND:
  • Load /admin panel ✅
  • Display AdminRequestsPanel
```

---

## 2. CUSTOMER JOB BOOKING FLOW

### 2.1 Create Job Flow
```
User on /dashboard (DashboardPanel component)
  ↓
Form inputs:
  • Service type (dropdown from bookableServiceTypes)
  • Description (text, required, 10+ chars)
  • Location (select from MOCK_LOCATIONS)
  • Estimated price (number, >0)
  • Payment method (card/upi/cash)
  ↓
On Submit:
  1. Validate inputs
  2. Call RPC: add_job()
     - Inserts into jobs table
     - Set user_id = auth.uid() (via trigger)
     - Set status = 'pending'
     - Set created_at = now
  3. On success:
     - Add to local jobs state
     - Show "Job posted! Searching for helpers..."
  ↓
Real-time subscription fires:
  • Listen on jobs channel for INSERT
  • Dashboard updates immediately
  ↓
Real-time worker notification:
  • Jobs feed refreshes for online workers
  • Matching workers see new job offer
```

### 2.2 Job Matching Logic (Customer → Worker)
```
New job posted with:
  • service_type: 'plumbing_help'
  • location_lat, location_lng
  • estimated_price: $150
  ↓
Background query (DashboardPanel):
  SELECT full_name, worker_status, worker_rating_avg, 
         worker_rating_count, worker_experience_years,
         worker_work_details, service_types
  FROM profiles
  WHERE is_worker = true 
    AND worker_verified = true
    AND worker_disabled = false
  ↓
scoreWorkerForService() algorithm:
  - Service type keyword match in work_details
  - Worker status (online=3pts, on_job=1.2pts, offline=0.6pts)
  - Rating score (avg * 0.7)
  - Volume score (count * 0.1, max 2 for 20+ jobs)
  - Experience score (min(years,12) * 0.2)
  - Keyword match score (matches * 1.4)
  ↓
Sort by recommendationScore (highest first)
  ↓
Display top workers in "Recommended workers" section
```

### 2.3 Cancel Job Flow
```
Customer views pending/accepted job
  ↓
Clicks "Cancel job" button
  ↓
Confirmation: "This cannot be undone"
  ↓
On confirm:
  • Call RPC: cancel_job(job_id)
  • Sets status = 'cancelled'
  • Updates updated_at = now
  ↓
Real-time update:
  • jobs subscription fires UPDATE event
  • UI reflects status change to "Cancelled"
```

### 2.4 Payment & Job Completion Flow
```
Worker completes job:
  • status transitions: pending → accepted → in_progress → completed
  ↓
Customer on /dashboard sees completed job
  ↓
UI shows:
  • Job status: "Completed"
  • Payment actions (if unpaid)
  • Rating panel
  ↓
Customer marks job as paid:
  • Click "Mark as paid"
  • Call RPC: mark_job_paid(job_id, payment_method)
  • Updates: payment_status = 'paid', paid_at = now
  ↓
Trigger refresh_worker_earnings() fires:
  • Calculates: company_fee_amount = final_price * 0.2
  • Calculates: worker_payout_amount = final_price - company_fee
  • Updates profiles.total_earnings for worker
  ↓
Customer rates worker:
  • Click on job → Open JobRatingPanel
  • Select 1-5 stars
  • Optional comment
  • On submit: INSERT into worker_ratings
  ↓
Trigger refresh_worker_rating_summary() fires:
  • Recalculates: worker_rating_avg
  • Recalculates: worker_rating_count
  • Updates profiles for worker
  ↓
Transaction complete ✅
```

---

## 3. WORKER/SERVICE PARTNER FLOW

### 3.1 Worker Profile Completion Flow
```
Worker after sign-up, on /worker:
  ↓
ProfileCompletionGate blocks view if:
  • full_name is empty
  • is_worker=true AND needs background check consent
  • is_worker=true AND NOT worker_verified
  • is_worker=true AND worker_disabled=true
  ↓
If worker_verified=false:
  Display form to complete:
  1. Profile Info:
     - Full name (from profile)
     - Service types (multi-select from bookableServiceTypes)
     - Work details/expertise
     - Years of experience
  2. Background Check (WorkerPanel component):
     - Legal full name
     - Date of birth
     - Work authorization status
     - SSN (9 digits)
     - Driver license info
     - Government ID type
     - Government ID document upload
     - Legal address
     - Payout account details (bank account)
  ↓
On submit:
  1. Validate all fields
  2. Upload government ID document to worker-id-documents bucket
  3. INSERT into worker_background_checks table
  4. Update profiles:
     - service_types array
     - worker_work_details
     - worker_experience_years
     - worker_profile_completed = true
  ↓
Admin review (see admin flow below)
  ↓
When admin approves:
  • worker_verified = true
  • Profile completion gate unlocks
  • Worker can now accept jobs ✅
```

### 3.2 Worker Job Acceptance Flow
```
Worker views /worker dashboard:
  ↓
Query jobs with:
  • status = 'pending'
  • Worker is online
  • Service type matches worker service_types
  • Location within zones (mock)
  ↓
Display "Available jobs" list:
  • Service type, description
  • Estimated price (split shown: worker gets 80%)
  • Customer rating (if rated)
  • Distance (mock)
  ↓
Worker clicks "Accept job":
  1. Check worker status = 'online'
  2. Check worker_verified = true
  3. Check worker_disabled = false
  4. Service type in worker service_types
  ↓
If all checks pass:
  • Call RPC: accept_job(job_id)
  • Updates jobs:
    - worker_id = auth.uid()
    - status = 'accepted'
    - accepted_at = now
  ↓
Real-time update triggers:
  • Job removed from other workers' feeds
  • Customer sees "Help on the way"
  • Worker added to job
  ↓
Worker sees job in "Active jobs" section ✅
```

### 3.3 Worker Job Progression Flow
```
After accepting job:
  ↓
Worker views active job details:
  • Customer name, description, address
  • Action button: "Start job"
  ↓
Worker clicks "Start job":
  • Call RPC: start_job(job_id)
  • Updates: status = 'in_progress'
  • Customer sees: "Worker arrived"
  ↓
Worker navigates using address provided
  ↓
Upon completion, worker clicks "Complete job":
  • Form: final_price (can differ from estimate)
  • Validation: final_price > 0
  • Call RPC: complete_job(job_id, final_price)
  • Updates: status = 'completed', completed_at = now
  ↓
Trigger: refresh_worker_earnings() fires
  • Calculates worker payout = final_price * 0.8
  • Updates profiles.total_earnings
  ↓
Job moves to "Completed" section
  • Shows: "Awaiting customer payment & rating"
  ↓
Customer receives notification:
  • Payment required to complete
  • Can rate worker
  ↓
After payment & rating:
  • Worker sees "Payment received"
  • Rating appears on profile
  ↓
Earnings added to total_earnings ✅
```

### 3.4 Worker Availability Toggle Flow
```
Worker on /worker dashboard:
  ↓
Toggle button: "Go online" / "Go offline"
  ↓
On click:
  • Update profiles.worker_status:
    - 'online' when available
    - 'offline' when unavailable
    - 'on_job' automatically (when job in progress)
  ↓
Real-time subscription updates:
  • Customer feeds refresh
  • Worker becomes available/unavailable for new jobs
```

### 3.5 Cancel Job (Worker) Flow
```
Worker with accepted but not started job:
  ↓
Click "Cancel job"
  ↓
Call RPC: cancel_worker_job(job_id)
  • Updates: status = 'cancelled_by_worker'
  ↓
Real-time triggers:
  • Job becomes available again
  • Other workers see job reappear
  • Customer sees: "Worker cancelled"
```

### 3.6 Worker Earnings & Payout Flow
```
Worker views /worker profile section:
  ↓
Display:
  • Total earnings (sum of all payouts)
  • Pending payout (unpaid completed jobs)
  • Earnings history (list of jobs with payment status)
  ↓
Worker rating panel:
  • Average rating
  • Number of ratings
  • Work history timeline
  ↓
Worker sets payout account (during background check):
  • Bank name
  • Account type (checking/savings)
  • Account holder name
  • Last 4 digits account
  • Last 4 digits routing
  ↓
When ready for payout:
  • Admin initiates payout (manual process)
  • Funds sent to stored bank account
  • Payment marked as 'paid'
```

---

## 4. ADMIN CONTROL FLOW

### 4.1 Admin Dashboard Access & Authentication
```
Admin URL: /admin
  ↓
AdminRequestsPanel checks:
  • Is user authenticated? (session.user.id exists)
  • Is admin? (isAdminEmail(session.user.email))
  ↓
If NOT admin:
  • Redirect to /dashboard
  • Access denied
  ↓
If admin:
  • Load AdminRequestsPanel ✅
  • Display: Workers queue, Jobs, Support requests, Activity log
```

### 4.2 Worker Verification Queue Flow
```
Admin on /admin dashboard:
  ↓
View "Worker Verification Queue" section:
  • Lists workers by priority:
    1. Profile incomplete (rank 1)
    2. Consent required (rank 0)
    3. Pending review (rank 1, after consent)
    4. Approved (rank 2)
    5. Paused (rank 3)
  ↓
Click on worker card:
  • Show detailed profile:
    - Basic info (name, email)
    - Background check documents
    - Work authorization status
    - ID document verification
    - Bank account details
    - Service types
    - Work experience
  ↓
Admin reviews documents:
  • Check government ID uploaded
  • Verify SSN format
  • Check address completeness
  • Verify bank account
  ↓
Action: Approve Worker:
  • Click "Approve" button
  • Call RPC: staff_update_worker_access(worker_id, verified=true, disabled=false)
  • Updates profiles:
    - worker_verified = true
    - worker_disabled = false
  ↓
Worker notified:
  • Status in ProfileCompletionGate updates
  • Can now access /worker and accept jobs
  ↓
Worker moves to "Active" section
```

### 4.3 Worker Access Management Flow
```
Admin views approved worker:
  ↓
If issues arise:
  • Click "Pause worker"
  • Call RPC: staff_update_worker_access(worker_id, verified=true, disabled=true)
  • Updates: worker_disabled = true
  ↓
Worker effects:
  • Cannot access /worker (blocked by gate)
  • Jobs no longer shown in feeds
  • Existing jobs still visible but new offers blocked
  ↓
To reactivate:
  • Click "Unpause"
  • Sets worker_disabled = false
  • Worker regains access
```

### 4.4 Job Management Flow
```
Admin dashboard "Jobs" section:
  ↓
View all jobs with filters:
  • Status (pending, accepted, in_progress, completed, cancelled)
  • Service type
  • Date range
  ↓
Click job details:
  • Customer info
  • Worker assigned (if any)
  • Job timeline:
    - Posted at
    - Accepted at
    - Started at
    - Completed at
  • Payment details:
    - Estimated price
    - Final price
    - Company fee (20%)
    - Worker payout (80%)
    - Payment status
  ↓
Admin can:
  • View full job history
  • Verify payment calculations
  • See rating given by customer
  ↓
If dispute:
  • Can update job status manually
  • Call RPC: staff_update_job_status(job_id, new_status)
  • Triggers: worker earnings refresh if needed
```

### 4.5 Support Requests & Comments Flow
```
Admin views "Support Requests" inbox:
  ↓
Lists all support_requests table entries:
  • User name, title
  • Status (open, in_progress, resolved, closed)
  • Created date
  ↓
Click request:
  • Show full description
  • Display comment thread:
    - Customer-visible comments (is_internal=false)
    - Internal staff notes (is_internal=true)
  ↓
Admin can:
  1. Add comment:
     • Type message
     • Select: "Public" or "Internal note"
     • On submit: INSERT into support_request_comments
       - request_id, author_id, body, is_internal, created_at
  2. Update status:
     • Select new status
     • Triggers: refresh of request list
  ↓
Comment thread auto-refreshes via realtime
  • Admin sees comments in real-time
  • Customer sees only public comments
```

### 4.6 Activity Log Flow
```
Admin views "Activity" section:
  ↓
Displays activity_events log (audit trail):
  • entity_type: 'job' | 'worker' | 'user'
  • action: 'created' | 'updated' | 'cancelled'
  • title, summary (human-readable)
  • timestamp
  • actor (which admin made change)
  ↓
Helps track:
  • Who verified which workers
  • Which jobs were updated
  • Payment transactions
  • Dispute resolutions
  ↓
Sorted by newest first
  • Most recent activity at top
```

---

## 5. REAL-TIME SYNCHRONIZATION FLOWS

### 5.1 Jobs Channel (Realtime Subscription)
```
Components subscribed: DashboardPanel, WorkerPanel, AdminRequestsPanel
  ↓
Listening on: public.jobs channel
  ↓
Events trigger:
  • INSERT (new job posted):
    - Add to appropriate feed (customer sees all, worker sees matching)
    - Update UI immediately
  • UPDATE (status change, price change):
    - Local state updated
    - UI reflects new status
  • DELETE (rare, job deleted):
    - Remove from local state
  ↓
Example flow:
  Customer posts job → INSERT event fires
  → Worker subscription receives event
  → Worker feed updates in real-time
  → Shows new job immediately
```

### 5.2 Profiles Channel (Realtime Subscription)
```
Components subscribed: AdminRequestsPanel, WorkerPanel
  ↓
Listening on: public.profiles channel
  ↓
Events trigger:
  • UPDATE (worker verified, disabled status changed):
    - Admin updates worker access
    - Worker profile updates
    - ProfileCompletionGate re-checks
    - Worker access granted/revoked
  • UPDATE (earnings updated):
    - Trigger: refresh_worker_earnings() fires
    - Worker payout changes
    - Display updates
  • UPDATE (ratings updated):
    - Trigger: refresh_worker_rating_summary() fires
    - Rating avg recalculated
    - Rating count updated
```

### 5.3 Support Requests Channel (Realtime Subscription)
```
Components subscribed: AdminRequestsPanel
  ↓
Listening on: public.support_requests, public.support_request_comments
  ↓
Events trigger:
  • INSERT support_request:
    - New request added
    - Appears in inbox
  • INSERT support_request_comments:
    - New comment in thread
    - Auto-refreshes conversation
    - Admin sees new message immediately
  • UPDATE support_requests:
    - Status changed
    - Request moves to different section
```

---

## 6. DATABASE TRIGGERS & AUTOMATED WORKFLOWS

### 6.1 User Registration Trigger
```
Trigger: on_auth_user_created
Event: new user signs up in auth.users
  ↓
Function: handle_new_user()
  ↓
Action:
  • INSERT into profiles table:
    - id = auth.user.id
    - email = auth.user.email
    - full_name = null (user fills later)
    - role = 'customer' (default)
    - is_worker = false (default)
    - created_at = now
```

### 6.2 Job Owner Assignment Trigger
```
Trigger: set_job_owner
Event: INSERT into jobs
  ↓
Function: set_job_owner()
  ↓
Action:
  • Set jobs.user_id = auth.uid()
  • Prevents users from creating jobs for others
```

### 6.3 Job Waybill Auto-Population Trigger
```
Trigger: jobs_waybill_fields_trigger
Event: UPDATE jobs (status changes)
  ↓
Function: set_job_waybill_fields()
  ↓
Action when job completed:
  • Auto-fill waybill fields:
    - waybill_date = completed_at
    - waybill_worker_id = worker_id
    - waybill_service_type = service_type
    - For export/documentation purposes
```

### 6.4 Worker Ratings Aggregation Trigger
```
Trigger: refresh_worker_rating_summary
Event: INSERT/UPDATE into worker_ratings
  ↓
Function: refresh_worker_rating_summary()
  ↓
Action:
  • Query worker_ratings for worker_id
  • Calculate: AVG(rating) → worker_rating_avg
  • Calculate: COUNT(*) → worker_rating_count
  • UPDATE profiles for worker:
    - worker_rating_avg
    - worker_rating_count
  ↓
Effect: Real-time rating updates on worker profile
```

### 6.5 Worker Earnings Aggregation Trigger
```
Trigger: refresh_worker_earnings
Event: INSERT/UPDATE into jobs (completed with payment)
  ↓
Function: refresh_worker_earnings()
  ↓
Action:
  • Query jobs WHERE worker_id = worker_id AND payment_status='paid'
  • Calculate: SUM(worker_payout_amount) → total_earnings
  • UPDATE profiles.total_earnings
  ↓
Effect: Worker earnings always current in real-time
```

### 6.6 Timestamp Update Triggers
```
Trigger: set_profiles_updated_at, set_support_requests_updated_at
Event: Any UPDATE to profiles or support_requests
  ↓
Function: set_current_timestamp_updated_at()
  ↓
Action:
  • Auto-set updated_at = now
  • Maintains data freshness for sorting/filtering
```

---

## 7. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION LAYER                        │
│                   (Supabase Auth + JWT)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    ┌───▼────┐        ┌────▼────┐      ┌────▼────┐
    │Customer│        │ Worker  │      │  Admin  │
    └────┬───┘        └────┬────┘      └────┬────┘
         │                 │                 │
    ┌────▼─────────┐   ┌───▼──────────┐  ┌──▼──────────┐
    │/dashboard    │   │/worker       │  │/admin       │
    │• Browse jobs │   │• Accept jobs │  │• Verify    │
    │• Post jobs   │   │• Track jobs  │  │• Manage    │
    │• Rate worker │   │• Earn $      │  │• Support   │
    └────┬─────────┘   └───┬──────────┘  └──┬──────────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
              ┌────────────▼────────────┐
              │   SUPABASE REALTIME     │
              │  Channel Subscriptions  │
              │ • jobs                  │
              │ • profiles              │
              │ • support_requests      │
              └────────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    ┌───▼────────┐   ┌────▼───────┐   ┌────▼──────┐
    │  Database  │   │  Triggers  │   │ Row-Level │
    │   Tables   │   │ Functions  │   │ Security  │
    │ • profiles │   │ • Validate │   │ • Customer│
    │ • jobs     │   │ • Aggregate│   │ • Worker  │
    │ • ratings  │   │ • Refresh  │   │ • Admin   │
    │ • payouts  │   │   state    │   │           │
    └────────────┘   └────────────┘   └───────────┘
```

---

## 8. STATE MANAGEMENT PATTERNS

### 8.1 Local Component State (React Hooks)
```typescript
// DashboardPanel
const [jobs, setJobs] = useState<Job[]>([])  // Customer's posted jobs
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

// WorkerPanel
const [availableJobs, setAvailableJobs] = useState<Job[]>([])
const [activeJobs, setActiveJobs] = useState<Job[]>([])
const [workerProfile, setWorkerProfile] = useState<WorkerProfile>()

// AdminRequestsPanel
const [workers, setWorkers] = useState<AdminWorkerProfile[]>([])
const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
const [comments, setComments] = useState<Record<string, SupportRequestComment[]>>({})
```

### 8.2 Real-time Synchronization Pattern
```typescript
useEffect(() => {
  const client = createSupabaseBrowserClient()
  
  // Subscribe to jobs channel
  const subscription = client
    .channel('public:jobs')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'jobs' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setJobs(prev => addJob(prev, payload.new))
        } else if (payload.eventType === 'UPDATE') {
          setJobs(prev => updateJob(prev, payload.new))
        }
      }
    )
    .subscribe()
  
  return () => subscription.unsubscribe()
}, [])
```

### 8.3 Optimistic Updates Pattern
```
User action: Click "Accept job"
  ↓
1. Update local state immediately
   setJobs(prev => updateJob(prev, {...job, status: 'accepted'}))
   ↓
2. Call RPC asynchronously
   await acceptJob(jobId)
   ↓
3a. If success: Real-time update confirms local state
3b. If error: Rollback local state
   setJobs(prev => updateJob(prev, {...job, status: 'pending'}))
   showError("Failed to accept job")
```

---

## 9. ERROR HANDLING & VALIDATION FLOWS

### 9.1 Job Creation Validation
```
Customer submits job form:
  ↓
Validations:
  ✓ Description length >= 10 chars
  ✓ Estimated price > 0
  ✓ Service type is bookable (in bookableServiceTypes)
  ✓ Location selected
  ✓ Payment method selected
  ↓
If validation fails:
  • Show inline error message
  • Prevent form submission
  ↓
If validation passes:
  • Send to server
  • Call prepare_job_insert RPC
  ↓
Server-side validations:
  ✓ User authenticated (auth.uid)
  ✓ Description not SQL injection
  ✓ Price is reasonable
  ↓
If passes: INSERT into jobs
If fails: Return error to UI
```

### 9.2 Worker Job Acceptance Validation
```
Worker clicks "Accept job":
  ↓
Client-side checks:
  ✓ Worker online?
  ✓ Job still pending?
  ↓
Server-side validations (in accept_job RPC):
  ✓ Worker is authenticated
  ✓ Worker verified (worker_verified=true)
  ✓ Worker not disabled (worker_disabled=false)
  ✓ Worker online (worker_status='online')
  ✓ Service type matches (job.service_type in worker.service_types)
  ✓ Job is pending (job.status='pending')
  ✓ No duplicate assignment
  ↓
If all pass:
  • Update job status
  • Assign worker
  ✓ Job accepted
  ↓
If any fail:
  • Return specific error
  • Show user: "You're not available for this job"
```

### 9.3 Payment Processing Validation
```
Customer marks job as paid:
  ↓
Validations:
  ✓ Job completed (status='completed')
  ✓ Job has final_price set
  ✓ final_price > 0
  ✓ Customer is job owner
  ✓ Payment status was 'unpaid'
  ↓
On success:
  • Update payment_status = 'paid'
  • Trigger earnings refresh
  ✓ Payment recorded
  ↓
On failure:
  • Show error
  • Keep status as 'unpaid'
```

---

## 10. SUMMARY OF ALL FLOWS

| Flow | Start | End | Key Actors | Data Changed |
|------|-------|-----|-----------|--------------|
| Customer Sign-Up | /auth?account=customer | /dashboard | User, Supabase Auth | profiles.full_name |
| Worker Sign-Up | /auth?account=helper | /worker (pending) | Worker, Admin | is_worker, consent_at |
| Admin Sign-In | /auth?account=admin | /admin | Admin | session |
| Job Creation | /dashboard form | Real-time feed | Customer | jobs INSERT |
| Job Matching | Job INSERT | Worker feed | Algorithm | N/A (display only) |
| Job Acceptance | Worker clicks accept | /worker active section | Worker, DB | jobs.worker_id, status |
| Job Completion | Worker submits | Earnings updated | Worker, Customer | jobs.status, completed_at |
| Payment | Customer marks paid | Earnings finalized | Customer, Admin | jobs.payment_status |
| Rating | Customer submits | Worker profile updated | Customer, Worker | worker_ratings, ratings_avg |
| Worker Approval | Admin reviews | /worker unlocked | Admin | profiles.worker_verified |
| Worker Pause | Admin disables | /worker blocked | Admin | profiles.worker_disabled |
| Support Request | Customer/Admin opens | Threads updated | Admin, Customer | support_requests |
| Real-time Sync | Event fired | UI updates | All | Channel subscriptions |

---

## 11. TECHNICAL NOTES

### RLS (Row-Level Security) Policies
- **Customers**: Can CRUD own jobs, see all worker profiles (public view)
- **Workers**: Can view available jobs, CRUD own profile, see own jobs
- **Admins**: Can read all tables, write to status/access controls
- **Support**: Staff can CRUD all support requests/comments

### Service Catalogs
- **Bookable types** (for posting): flat_tire, jump_start, fuel_delivery, etc.
- **Worker specialties**: Subset of bookable types each worker can do
- **Home care**: cna_support, senior_helper (require special licensing in real app)

### Payment Split
- **Company takes**: 20% (company_fee_amount)
- **Worker gets**: 80% (worker_payout_amount)
- Example: $100 job → Worker gets $80, Company gets $20

### Verification Workflow
1. Worker consents to background check
2. Admin reviews documents (government ID, SSN, address, payout account)
3. Admin approves → worker_verified = true
4. Worker can now access marketplace

### Real-time Architecture
- Supabase Realtime subscribed on multiple channels
- Multiple listeners per channel (same event can trigger different handlers)
- Auto-reconnect on connection loss
- Batched updates from triggers
