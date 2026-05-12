# RapidoHelp - SMTP Configuration Analysis

**Document Generated:** May 11, 2026

---

## 📧 SMTP Overview

SMTP (Simple Mail Transfer Protocol) in RapidoHelp is used to send **authentication OTP codes** to users during sign-up and sign-in processes. The system is configured with Microsoft 365 (GoDaddy mailbox) as the email provider.

---

## 1. SMTP CONFIGURATION

### 1.1 Configuration File Location
**File:** `supabase/config.toml`

```toml
[auth.email.smtp]
host = "env(SMTP_HOST)"
port = 587
user = "env(SMTP_USER)"
pass = "env(SMTP_PASS)"
admin_email = "env(SMTP_ADMIN_EMAIL)"
sender_name = "RapidoHelp Helpdesk"
```

### 1.2 SMTP Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **host** | `smtp.office365.com` | Microsoft 365 SMTP server |
| **port** | `587` | STARTTLS port (standard for secure SMTP) |
| **user** | `helpdesk@rapidohelp.com` | GoDaddy helpdesk mailbox |
| **pass** | `[from .env]` | Helpdesk mailbox password |
| **admin_email** | `helpdesk@rapidohelp.com` | Sender email address |
| **sender_name** | `RapidoHelp Helpdesk` | Display name in emails |

### 1.3 Environment Variables Location
**File:** `.env` (root directory, excluded from git)

```bash
SMTP_HOST=smtp.office365.com
SMTP_USER=helpdesk@rapidohelp.com
SMTP_PASS=your-helpdesk-mailbox-password
SMTP_ADMIN_EMAIL=helpdesk@rapidohelp.com
```

**Note:** Copy from `.env.example` and fill in real values:
```bash
cp .env.example .env
```

---

## 2. EMAIL TEMPLATE CONFIGURATION

### 2.1 Email Template
**File:** `supabase/templates/magic_link.html`

```html
<!doctype html>
<html lang="en">
  <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #172033;">
    <h2>Your RapidoHelp sign-in code</h2>
    <p>Enter this code to finish signing in:</p>
    <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.3em; margin: 24px 0;">{{ .Token }}</p>
    <p>This code expires soon. If you did not request it, you can ignore this email.</p>
  </body>
</html>
```

### 2.2 Template Configuration (config.toml)
```toml
[auth.email.template.magic_link]
subject = "Your RapidoHelp sign-in code"
content_path = "./supabase/templates/magic_link.html"
```

### 2.3 Token Placeholder
- **Placeholder:** `{{ .Token }}`
- **Value:** 6-digit OTP code (configured in auth settings)
- **Expires:** 3600 seconds (1 hour)

---

## 3. OTP (ONE-TIME PASSWORD) SETTINGS

### 3.1 OTP Configuration (config.toml)
```toml
[auth.email]
enable_signup = true
enable_confirmations = false
double_confirm_changes = true
secure_password_change = true
max_frequency = "1m"
otp_length = 6
otp_expiry = 3600
```

| Setting | Value | Meaning |
|---------|-------|---------|
| **otp_length** | 6 | Six-digit code (e.g., `123456`) |
| **otp_expiry** | 3600 | Valid for 1 hour after sending |
| **max_frequency** | `1m` | User can request new code after 1 minute |
| **enable_signup** | true | Users can sign up via email OTP |
| **enable_confirmations** | false | No email confirmation needed (auto-confirm) |

---

## 4. AUTHENTICATION FLOW WITH SMTP

### 4.1 Customer Sign-Up Email Flow

```
User on /auth?account=customer
  ↓
Enters email address (e.g., john@example.com)
  ↓
Clicks "Sign up with email"
  ↓
Supabase Auth:
  1. Validates email format
  2. Generates 6-digit OTP code
  3. Creates email task:
     - To: john@example.com
     - From: helpdesk@rapidohelp.com (via SMTP)
     - Subject: "Your RapidoHelp sign-in code"
     - Body: Renders magic_link.html with {{ .Token }} = OTP
  4. Sends via SMTP to office365.com
  ↓
Microsoft 365 Server:
  • SMTP connection over port 587 with STARTTLS
  • Authentication: helpdesk@rapidohelp.com / password
  • Receives email task
  • Sends to john@example.com
  ↓
User receives email:
  Subject: "Your RapidoHelp sign-in code"
  Body: Shows 6-digit code (e.g., 123456)
  ↓
User enters code in /auth form
  ↓
Supabase validates:
  ✓ Code matches generated OTP
  ✓ Code not expired (< 1 hour)
  ✓ Email not previously registered
  ↓
On success:
  • User account created in auth.users
  • Session established with JWT token
  • User redirected to /dashboard
  ↓
Trigger: on_auth_user_created fires
  • Inserts user into profiles table
  • Sets is_worker = false (customer)
```

### 4.2 Worker Sign-Up Email Flow (Same)
```
Same as customer but:
  • is_worker = true (set by UI during sign-up)
  • worker_background_check_consent_at = now (set during signup)
  • worker_background_check_consent_version = 'helper_background_check_v1'
```

### 4.3 Sign-In Email Flow

```
Returning user on /auth?mode=signin
  ↓
Enters registered email
  ↓
Clicks "Sign in with email"
  ↓
Supabase Auth:
  1. Finds matching auth.users record
  2. Generates new 6-digit OTP
  3. Sends via SMTP (same as sign-up)
  ↓
User receives email with new code
  ↓
User enters code → Session created
```

### 4.4 Admin Sign-In (Different Method)

```
Admin on /auth?account=admin
  ↓
Email pre-filled: helpdesk@rapidohelp.com
  ↓
Enters password (not OTP)
  ↓
Calls: signInWithPassword()
  ↓
Supabase validates:
  ✓ Email exists
  ✓ Password matches
  ✓ User role checked (isAdminEmail)
  ↓
On success:
  • Admin session created
  • Redirect to /admin
  ↓
NO EMAIL SENT (password-based, not OTP)
```

---

## 5. LOCAL DEVELOPMENT SETUP

### 5.1 Start Supabase Locally

```bash
cd /Users/naveenantil/Documents/rapidohelp
supabase start
```

**Output:**
```
Started supabase local development setup.

         API URL: http://localhost:54321
     Anon Key: eyJ...
  Service role key: eyJ...

         DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
        Studio URL: http://localhost:54323
       Inbucket URL: http://localhost:54324
```

### 5.2 Configure SMTP in `.env`

```bash
cp .env.example .env
```

**Edit `.env` with real SMTP values:**
```bash
SMTP_HOST=smtp.office365.com
SMTP_USER=helpdesk@rapidohelp.com
SMTP_PASS=actual-mailbox-password  # ← Replace with real password
SMTP_ADMIN_EMAIL=helpdesk@rapidohelp.com
```

### 5.3 Restart Supabase to Load SMTP Config

```bash
supabase stop
supabase start
```

Supabase will now read from `.env` file and use the SMTP settings.

### 5.4 Test Email Delivery

**Option A: Using Real Microsoft 365 Mailbox**
1. Sign up at http://localhost:3000/auth?account=customer
2. Enter test email address
3. Check helpdesk@rapidohelp.com mailbox (or Outlook)
4. Verify email received with OTP code

**Option B: Local Inbucket (No Real Email Required)**
```
Available at: http://localhost:54324
- View all emails sent by local Supabase
- No external email provider needed
- Useful for testing without SMTP credentials
```

**To use Inbucket:**
1. Access http://localhost:54324
2. Sign up at http://localhost:3000/auth
3. Emails appear in Inbucket (not sent to real address)

---

## 6. MOBILE FLUTTER SETUP WITH SMTP

### 6.1 Run Flutter with SMTP Configuration

```bash
cd apps/mobile
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key \
  --dart-define=SMTP_USER=helpdesk@rapidohelp.com \
  --dart-define=SMTP_PASS=your-helpdesk-mailbox-password
```

### 6.2 Mobile Auth Flow

```
Flutter App on /auth
  ↓
User selects: "Email OTP" or "Phone OTP"
  ↓
If Email OTP:
  1. App calls Supabase signUpWithPassword()
  2. SMTP email sent (same flow as web)
  3. User enters OTP in app
  4. Session created
  ↓
If Phone OTP (alternative):
  1. App calls Supabase signUpWithPhone()
  2. OTP sent via SMS (different provider, not SMTP)
  3. User enters OTP in app
  4. Session created
```

### 6.3 Fallback Authentication (If SMTP Unavailable)

**Demo quick-start buttons:**
```bash
flutter run \
  --dart-define=DEV_WORKER_EMAIL=demo@local \
  --dart-define=DEV_WORKER_PASSWORD=Demo123!
```

When SMTP/OTP not available, workers can:
- Tap "Quick start: Worker" button
- Uses DEV_WORKER_EMAIL/PASSWORD
- Bypasses OTP requirement
- For testing/demo only

---

## 7. MICROSOFT 365 / SMTP TROUBLESHOOTING

### 7.1 Common SMTP Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Connection refused on port 587** | Firewall blocking | Enable outbound port 587 |
| **Authentication failed** | Wrong password | Verify helpdesk@rapidohelp.com password |
| **STARTTLS handshake error** | TLS version mismatch | Ensure TLS 1.2+ supported |
| **Emails not sending** | Wrong host | Use `smtp.office365.com` (not `smtp.gmail.com`) |
| **Rate limit exceeded** | Too many emails in short time | Respect max_frequency: 1m between requests |
| **Relay access denied** | Sending from wrong address | Use `helpdesk@rapidohelp.com` as admin_email |

### 7.2 Verify SMTP Connection

```bash
# Check if port 587 is open to Microsoft 365
nc -zv smtp.office365.com 587

# Expected output: Connection successful
```

### 7.3 Debug SMTP in Supabase Logs

```bash
# View Supabase auth logs
supabase log -f

# Look for SMTP errors:
# - "SMTP connection failed"
# - "Authentication failed"
# - "Email sent successfully"
```

### 7.4 Test with Inbucket

```bash
# Access local email testing
curl http://localhost:54324/api/mailbox
```

---

## 8. ENVIRONMENT VARIABLE REFERENCE

### 8.1 Required SMTP Variables

```bash
# In .env file (root directory)

SMTP_HOST=smtp.office365.com
SMTP_USER=helpdesk@rapidohelp.com
SMTP_PASS=<mailbox-password>
SMTP_ADMIN_EMAIL=helpdesk@rapidohelp.com

# Optional fallback for development/testing
DEV_WORKER_EMAIL=demo@local
DEV_WORKER_PASSWORD=Demo123!
DEV_CUSTOMER_EMAIL=customer@local
DEV_CUSTOMER_PASSWORD=Demo123!
```

### 8.2 Supabase Variables (config.toml)

```toml
# Read from .env file
host = "env(SMTP_HOST)"
user = "env(SMTP_USER)"
pass = "env(SMTP_PASS)"
admin_email = "env(SMTP_ADMIN_EMAIL)"
```

### 8.3 Authentication Rate Limiting

```toml
[auth.rate_limit]
email_sent = 30  # Max 30 emails per hour per IP
```

---

## 9. EMAIL TEMPLATE CUSTOMIZATION

### 9.1 Current Template
**File:** `supabase/templates/magic_link.html`

Shows:
- Header: "Your RapidoHelp sign-in code"
- OTP: 6-digit code in large font
- Footer: "Code expires soon..." warning

### 9.2 Available Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{ .Token }}` | 6-digit OTP code | `123456` |
| `{{ .SiteURL }}` | Your app domain | `https://rapidohelp.com` |
| `{{ .ConfirmationURL }}` | Not used (auto-confirm enabled) | N/A |

### 9.3 Modify Email Subject

**In config.toml:**
```toml
[auth.email.template.magic_link]
subject = "Your RapidoHelp sign-in code"  # ← Change here
```

### 9.4 Modify Email HTML

**Edit `supabase/templates/magic_link.html`:**
```html
<!doctype html>
<html>
  <body>
    <h1>RapidoHelp Authentication</h1>
    <p>Your verification code:</p>
    <p style="font-size: 36px; font-weight: bold;">{{ .Token }}</p>
    <p>Code valid for 1 hour.</p>
  </body>
</html>
```

**Restart Supabase after changes:**
```bash
supabase stop
supabase start
```

---

## 10. SECURITY CONSIDERATIONS

### 10.1 SMTP Security

✅ **Implemented:**
- Port 587 with STARTTLS encryption
- Secure password stored in `.env` (not in code)
- Helpdesk mailbox for all outbound auth emails
- OTP rate limiting (max 30/hour)

⚠️ **Cautions:**
- `.env` file excluded from git (add to `.gitignore`)
- Password change = Supabase restart required
- Port 587 firewall must allow outbound

❌ **NOT Implemented (Future):**
- SPF/DKIM/DMARC configuration
- Email bounce handling
- Bounced email feedback loop
- Email delivery verification

### 10.2 Protect Mailbox Credentials

```bash
# .gitignore - should already exclude .env
/.env
/.env.local
/.env.*.local
```

### 10.3 Password Management

For production, consider:
1. Store SMTP password in secure secret manager
2. Rotate password periodically
3. Use service account (not personal mailbox)
4. Enable audit logging on helpdesk@rapidohelp.com

---

## 11. SMTP CONFIGURATION CHECKLIST

### 11.1 Local Development

- [ ] `.env` file created from `.env.example`
- [ ] `SMTP_HOST` set to `smtp.office365.com`
- [ ] `SMTP_USER` set to `helpdesk@rapidohelp.com`
- [ ] `SMTP_PASS` set to actual mailbox password
- [ ] `SMTP_ADMIN_EMAIL` set to `helpdesk@rapidohelp.com`
- [ ] Supabase restarted after `.env` changes
- [ ] Port 587 accessible (firewall allows)
- [ ] Email template configured in `config.toml`

### 11.2 Testing

- [ ] Can sign up with email OTP
- [ ] OTP email received within 5 seconds
- [ ] OTP code is 6 digits
- [ ] OTP expires after 1 hour
- [ ] Can't reuse same code
- [ ] Can request new code after 1 minute
- [ ] Admin can sign in with password
- [ ] Mobile app receives OTP emails

### 11.3 Production Deployment

- [ ] SMTP credentials stored in secret manager (not git)
- [ ] Separate mailbox for auth emails
- [ ] SPF/DKIM/DMARC records configured
- [ ] Email deliverability monitoring set up
- [ ] Bounce handling implemented
- [ ] Rate limiting tuned for expected volume
- [ ] Email template branded for production

---

## 12. CURRENT SMTP STATUS

### ✅ Configured
- SMTP host: `smtp.office365.com`
- SMTP port: `587`
- SMTP user: `helpdesk@rapidohelp.com`
- Email template: `supabase/templates/magic_link.html`
- OTP length: 6 digits
- OTP expiry: 1 hour
- Rate limit: 30 emails/hour

### ⏳ Requires Setup
- `.env` file with actual password (template only provided)
- Supabase restart to load configuration

### 📋 Testing Paths
1. **With Real Email:** Use actual helpdesk password in `.env`
2. **Local Testing:** Use Inbucket at http://localhost:54324
3. **Demo/Fallback:** Use DEV_WORKER_* variables

---

## 13. QUICK START COMMANDS

```bash
# 1. Setup local SMTP
cp .env.example .env
# Edit .env: SMTP_PASS = actual password

# 2. Start Supabase with SMTP
supabase stop
supabase start

# 3. Test web signup
open http://localhost:3000/auth?account=customer
# Sign up with email, check Inbucket at http://localhost:54324

# 4. Test mobile (if Flutter installed)
flutter run \
  --dart-define=SUPABASE_URL=http://localhost:54321 \
  --dart-define=SUPABASE_ANON_KEY=<from supabase start output>

# 5. Inspect local emails (Inbucket)
open http://localhost:54324

# 6. View Supabase logs
supabase log -f
```

---

## Summary

**SMTP is fully configured** for RapidoHelp authentication:
- ✅ Email provider: Microsoft 365 (GoDaddy)
- ✅ OTP delivery: 6-digit codes via email
- ✅ Template: Custom HTML with branding
- ✅ Security: STARTTLS on port 587
- ✅ Rate limiting: 30/hour per IP
- ⏳ Requires: `.env` password + Supabase restart

**Next steps:** Set up real helpdesk mailbox password and test OTP flow.
