# Architecture

## Goal

Use one repository for product delivery across web, mobile, and backend while keeping shared backend behavior in Supabase instead of a separate custom API server.

## Boundaries

- `apps/web`: customer-facing and admin-facing browser experiences built with Next.js.
- `apps/mobile`: Flutter client for iOS and Android.
- `supabase/`: schema, auth, storage, SQL functions, row-level security, and local development configuration.

## Integration model

- Authentication is handled by Supabase Auth.
- Profile bootstrap is handled by the database trigger in `supabase/migrations`.
- Web and mobile both talk directly to Supabase using platform SDKs.
- Business rules that must be trusted belong in Postgres policies, SQL functions, or edge functions when needed.

## Near-term evolution

1. Add domain tables and policies in `supabase/migrations`.
2. Add feature folders in web and mobile that mirror the same product concepts.
3. Introduce shared API contracts and UX flows in `docs/` before adding more packages.
4. Add edge functions only for logic that cannot live safely in SQL or client SDK flows.