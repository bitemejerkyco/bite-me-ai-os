# Technical Architecture

## Verified package baseline

The current `package.json` identifies:

- `next` 16.2.x
- `react` and `react-dom` 19.2.x
- TypeScript 5
- Tailwind CSS 4
- Supabase SSR 0.12.x
- Supabase JS 2.111.x
- Remotion and Remotion Player 4.0.x
- FFmpeg Static 5.3.x
- Resend 6.18.x
- Stripe 22.4.x
- Vitest 4.1.x
- ESLint 9

Scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm test`
- `npm run validate:help`

## Expected architecture

Cursor must verify all paths before relying on this model.

### Frontend

Likely Next.js App Router with React Server Components and client components for interactive editors, calendars, uploaders, and generation progress.

### Backend

Likely Next.js route handlers and/or server actions. External provider calls must remain server-side.

### Identity and data

Supabase is expected to provide:

- Authentication
- PostgreSQL
- Row Level Security
- Object storage
- Workspace-scoped application data

### Deployment

Vercel hosts the application. Production domain/history includes a Vercel deployment for PostMotive. Verify the active project, domains, branch deployment rules, environment variables, and build logs.

### External services

Known or intended:

- Supabase — auth, database, storage
- Replicate — AI video generation
- Resend — transactional email
- Stripe — billing and credits
- TikTok APIs — authentication, profile/display, sharing/content posting depending on approved scopes
- Remotion/FFmpeg — video composition or rendering utilities

Other social, AI, analytics, email, or commerce integrations must be discovered from the current codebase.

## Required architecture audit

Cursor should produce a repository map covering:

1. App routes and layouts
2. API routes and server actions
3. Shared UI components
4. Domain services
5. Provider adapters
6. Supabase clients
7. Database migrations
8. Generated database types
9. Storage buckets
10. RLS policies
11. Auth and workspace resolution
12. Credit ledger/reservations
13. Generation job tables and status
14. Publishing connections and tokens
15. Help registry
16. Tests
17. Deployment configuration
18. Environment variables

## Preferred boundaries

- UI components render and collect input.
- Domain services implement reusable business logic.
- Repositories or data-access functions isolate database operations.
- Provider adapters isolate third-party APIs.
- API handlers authenticate, authorize, validate, invoke services, and translate errors.
- Credit logic should be centralized.
- Compliance evaluation should be centralized and auditable.
- User-facing status should derive from durable job state, not only local React state.

## Multi-tenant requirements

Every tenant-owned record should have a reliable workspace/business/account association. Authorization must be checked server-side and reinforced through RLS. Tests should attempt access using another workspace's ID.

## Job lifecycle recommendation

For expensive generation:

`created -> credit_reserved -> queued -> processing -> completed`

Failure states:

`failed_refunded`, `failed_refund_pending`, `cancelled_refunded`

Store provider IDs, retry count, timestamps, safe diagnostic code, output asset ID, and credit transaction IDs.

## Observability

At minimum, capture:

- Request/job correlation ID
- Workspace ID
- Feature/workflow
- Provider
- Duration
- Outcome
- Safe error category
- Credits reserved/refunded
- Publishing confirmation ID

Never log secrets or raw OAuth tokens.
