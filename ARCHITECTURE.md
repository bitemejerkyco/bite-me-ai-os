# PostMotive AI Architecture

## Current Folder Structure
- app: Next.js App Router routes, layouts, and error/loading boundaries
- components: UI and dashboard presentation components
- config: Typed application and feature configuration
- features: Feature-first scaffolding for domain growth
- lib: Shared infrastructure, auth, provider abstractions, and services
- prisma: Database schema and migrations
- types: Cross-cutting TypeScript contracts
- docs: Product and feature specifications

## Feature-First Organization
The platform uses feature-first boundaries for roadmap domains (dashboard, brand-brain, knowledge-hub, ai-employees, content-studio, campaigns, calendar, analytics). Each feature has lightweight folders for components, services, schemas, and types.

## Rendering Model
Server Components are default. Client Components are used only for interactive concerns such as navigation state, dialogs, and animated dashboard behavior.

## Server Actions and Route Handlers
- Route handlers handle callback and API edge cases.
- Server Actions are used where authenticated state-changing workflows are needed.
- External input is validated with Zod before domain execution.

## Domain Services
Domain logic should be isolated in service modules within features or lib modules, leaving route segments thin and orchestration-focused.

## Prisma Data Access
- Prisma is configured for PostgreSQL.
- A singleton client pattern avoids client duplication during Next.js development reloads.
- Workspace, membership, and brand models provide the base for authorization-aware data access.

## Workspace Authorization
- Authentication is resolved through Supabase SSR helpers.
- Workspace membership checks enforce role-aware access with a clear setup-mode behavior when auth/data are not configured.

## AI Provider Abstraction
- The architecture targets provider independence across OpenAI and Anthropic.
- Provider clients should remain behind typed interfaces so orchestration code is decoupled from vendor SDK specifics.

## Prompt Registry
- Prompt definitions and templates should be centrally managed and versioned.
- Prompt execution should capture evidence and metadata, not only final generated content.

## Worker Architecture
- Long-running and asynchronous AI workflows are intended for worker execution rather than request-bound page handlers.
- Worker selection is deferred, but queue-backed orchestration is assumed in architecture decisions.

## Queue Abstraction
- Queue integration should be abstracted behind domain interfaces to allow runtime flexibility.
- Command payloads must remain typed and traceable for retries and auditability.

## Evidence-First AI
- Deterministic extraction and validation should happen before AI reasoning.
- Final AI conclusions should include evidence references where possible.

## Logging and Error Handling
- Structured logger with recursive sensitive field redaction.
- Consistent API response envelope with no client stack traces.
- Runtime failures are surfaced via app-level and global error boundaries.

## Testing Standards
- Vitest + Testing Library + jsdom baseline
- Unit tests for shared infra, auth guards, and configuration
- Typecheck and lint required in CI

## Security Standards
- No committed secrets
- Environment schema validation through Zod
- SSRF-safe patterns required for website fetching features
- CI includes CodeQL and non-blocking npm audit
- Authorization checks required for workspace-scoped operations
