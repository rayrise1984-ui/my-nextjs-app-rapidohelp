# Deployment

## Web on Vercel

Use the repository root as the connected Git repository and leave the Vercel project Root Directory set to the repository root. The root `vercel.json` runs the web workspace build.

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (for example, `https://rapidohelp.com`)

Recommended build settings:

- Root Directory: repository root
- Framework preset: Next.js
- Install command: `npm install`
- Build command: `npm run build:web`
- Output directory: leave default for Next.js

## Supabase production

1. Create a Supabase project.
2. Apply migrations from `supabase/migrations`.
3. Configure Auth redirect URLs for:
   - local web development
   - production web domain
   - mobile deep link callback

Environment values needed by clients:

- Web uses `.env` values from the project root.
- Mobile uses `--dart-define=SUPABASE_URL=...` and `--dart-define=SUPABASE_ANON_KEY=...`.

## Custom domain

Set the production domain in Vercel and Supabase before launch.

### Vercel

Add your apex domain and `www` subdomain to the Vercel project. At your DNS provider, use:

```text
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns-0.com
```

Then set the Vercel production environment variable:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

Use the same value locally when testing production callback behavior.

### Supabase Auth

In Supabase Dashboard -> Authentication -> URL Configuration:

```text
Site URL:
https://your-domain.com

Redirect URLs:
https://your-domain.com/auth
https://your-domain.com/dashboard
https://your-domain.com/worker
http://localhost:3000/**
rapidohelp://auth
```

For Vercel preview deployments, add the preview wildcard shown by Vercel/Supabase for your team slug.

### Auth SMTP

Supabase Auth email delivery is configured in `supabase/config.toml` for local development.
Use a root `.env` file for SMTP secrets:

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_ADMIN_EMAIL`

For production Supabase projects, configure the same SMTP provider in the Supabase Dashboard under Authentication settings or through the Management API. Use a verified sender address for `SMTP_ADMIN_EMAIL`.

## GitHub Actions secrets

If you use the included deploy workflow, configure these repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Notes

- The deploy workflow is intentionally manual-safe: it expects secrets and a functioning local toolchain in CI.
- Keep privileged Supabase keys out of client apps. Only public anon keys belong in web and mobile.
