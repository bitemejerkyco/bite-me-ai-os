# PostMotive AI

Every Post Has a Motive.

PostMotive AI is an AI-powered marketing operations platform for modern brands. This Sprint 1A foundation establishes the production-ready shell for authentication, routing, dashboard navigation, environment validation, health monitoring, and Prisma data modeling.

## Sprint 1A Functionality

- Next.js 16 App Router foundation with grouped auth and dashboard route layouts
- Supabase SSR auth utilities using `@supabase/ssr`
- Setup-safe authentication pages (`/login`, `/signup`, `/forgot-password`)
- Next.js 16 `proxy.ts` route protection and auth redirection logic
- Responsive dashboard shell with desktop and mobile navigation
- Root redirect from `/` to `/dashboard`
- Placeholder feature pages for planned modules
- Typed environment validation using Zod with graceful setup mode
- Prisma 7 schema and generator output configured at `app/generated/prisma`
- Structured logging utility with basic secret redaction
- Health endpoint at `/api/health`

## Requirements

- Node.js 20+
- npm (repository uses `package-lock.json`)

## Installation

```bash
npm install
```

## Environment Configuration

Copy `.env.example` to `.env.local` and fill values as needed:

```bash
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The application compiles without these values, but auth and persistence remain in setup mode.

## Supabase Setup

Authentication requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Without these, auth pages show setup mode and sign-in/sign-up actions do not simulate success.

## Database Setup

Persistence requires:

- `DATABASE_URL` (PostgreSQL)

Prisma client generation works after dependencies are installed. Database migration/push commands require a valid `DATABASE_URL`.

## Development Commands

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

## Production Build

```bash
npm run build
npm run start
```

## Project Structure

- `app/(auth)` auth routes and pages
- `app/(dashboard)` dashboard shell and planned feature pages
- `app/auth/callback` Supabase auth callback route
- `app/api/health` health status route
- `components/auth` auth UI
- `components/dashboard` dashboard shell UI
- `components/ui` reusable primitive components
- `lib/env.ts` environment validation and setup flags
- `lib/supabase` Supabase SSR browser/server/proxy helpers
- `lib/auth/actions.ts` server-side auth actions
- `lib/db/prisma.ts` Prisma singleton and adapter access
- `prisma/schema.prisma` initial data model
- `proxy.ts` Next.js 16 proxy entry

## Current Limitations

- Supabase and PostgreSQL must be configured before authentication and persistence work.
- Feature pages beyond dashboard shell are placeholders in Sprint 1A.
- Notifications and advanced interactive command features are intentionally disabled until implemented.

## Next Sprint

Sprint 1B will implement organization onboarding, persisted dashboard data wiring, and initial campaign/domain models backed by database queries.
