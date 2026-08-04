# PostMotive Agent Instructions

## Product mission

PostMotive is an AI Marketing Director for small businesses, not merely an AI writing tool. It should learn the business, propose strategy, create content, organize assets, schedule publishing, measure results, and improve recommendations.

The defining product promise is:

> A business owner with little or no marketing experience can create and schedule professional marketing without needing to understand prompting, advertising terminology, or complex software.

## Founder priorities

1. Make every workflow understandable to a novice.
2. Reduce clicks and decisions.
3. Prefer guided defaults over blank forms.
4. Preserve the bright, premium, friendly PostMotive brand.
5. Avoid technical terminology in customer-facing UI.
6. Build reliable, production-safe workflows before expanding features.
7. Control AI generation costs, especially video.
8. Support regulated-industry marketing through Compliance Mode.
9. Keep existing working behavior intact unless the task explicitly changes it.
10. Never silently remove features or data.

## Required working method

Before changing code:

1. Read `docs/PROJECT_CONTEXT.md`.
2. Read the relevant files in `.cursor/rules/`.
3. Inspect the current branch, git status, package scripts, related source files, tests, migrations, and environment-variable references.
4. State the intended scope and identify assumptions.
5. Reuse existing patterns before introducing new abstractions.

During implementation:

- Make the smallest coherent change that fully solves the task.
- Keep business logic out of presentation components when practical.
- Preserve TypeScript safety.
- Validate server-side authorization and workspace ownership.
- Never expose provider secrets to client code.
- Use idempotency for paid or credit-consuming workflows.
- Add or update tests for meaningful behavior.
- Update documentation when behavior or architecture changes.

Before declaring completion, run the repository's required validation sequence:

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run validate:help` when help registry or user-facing help changes
5. `git diff --check`
6. `git status --short`

Stop and report failures. Fix only failures caused by the current change unless explicitly instructed otherwise.

## Architecture baseline

Verified package baseline:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase SSR and Supabase JS
- Remotion
- FFmpeg static
- Resend
- Stripe
- Vitest
- ESLint
- Vercel deployment

Treat the repository as the source of truth. Do not assume that a remembered feature is fully implemented.

## UX requirements

Every major page must make these clear:

- What is this page?
- What should the user do now?
- What happens after they do it?
- What is the recommended action?

Avoid:

- Empty dashboards with no guidance
- Multiple primary buttons
- Marketing jargon without explanation
- Asking novice users to write prompts
- Dead ends
- Hidden status or unexplained failures
- Repeated configuration questions already answered in onboarding

## Data and security

- Enforce tenant/workspace isolation.
- Respect Supabase RLS; do not rely only on client filtering.
- Never log access tokens, refresh tokens, API keys, full payment data, or sensitive user content.
- Validate webhooks and external callbacks.
- Make migrations backward-compatible where feasible.
- Never modify old migrations that may already be applied; add a new migration.
- Protect credit reservations, refunds, and external-generation jobs from double processing.

## Source-of-truth hierarchy

When information conflicts, follow:

1. Current production behavior and database state
2. Current `main` branch code and migrations
3. Tests and provider configuration
4. Documentation in this package
5. Historical notes

Call out discrepancies instead of guessing.
