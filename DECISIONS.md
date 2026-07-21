# Architecture Decision Records

## ADR-001: Next.js App Router
- Status: Accepted
- Context: The platform requires server-first rendering, route grouping, and flexible data boundaries.
- Decision: Use Next.js App Router for route architecture and rendering defaults.
- Consequences: Server Components become the default pattern with explicit client opt-in for interactivity.

## ADR-002: TypeScript Strict Mode
- Status: Accepted
- Context: Platform code requires maintainable contracts across product, infra, and AI modules.
- Decision: Use TypeScript strict mode and avoid unsafe any-based contracts.
- Consequences: Increased upfront typing work with reduced runtime ambiguity.

## ADR-003: Prisma ORM
- Status: Accepted
- Context: A typed data layer is needed for multi-entity growth and migration workflows.
- Decision: Use Prisma for schema, migration, and generated client access.
- Consequences: Prisma validate/generate become required build checks.

## ADR-004: PostgreSQL Production Target
- Status: Accepted
- Context: The platform requires relational integrity, indexing, and scalable production support.
- Decision: Standardize on PostgreSQL as the production datasource target.
- Consequences: Schema and migration definitions are optimized for PostgreSQL semantics.

## ADR-005: Supabase Authentication Foundation
- Status: Accepted
- Context: Product needs SSR-friendly auth setup with hosted identity support.
- Decision: Use Supabase SSR helpers for authenticated user/session foundations.
- Consequences: Auth operates in explicit setup mode when environment variables are absent.

## ADR-006: Feature-First Modules
- Status: Accepted
- Context: Product roadmap spans multiple domains and should avoid monolithic folder growth.
- Decision: Organize scalable logic under feature-first module boundaries.
- Consequences: Shared primitives remain in lib while domain concerns evolve in features.

## ADR-007: Server Components by Default
- Status: Accepted
- Context: Most pages are data/presentation-oriented and do not require client hydration.
- Decision: Keep components server-rendered unless interaction requires client runtime.
- Consequences: Better performance baseline and smaller client bundles.

## ADR-008: Deterministic Extraction Before AI
- Status: Accepted
- Context: AI outputs are more reliable when grounded by validated structured inputs.
- Decision: Perform deterministic parsing/extraction before AI generation or reasoning.
- Consequences: Additional preprocessing logic but lower hallucination risk.

## ADR-009: Evidence-First Conclusions
- Status: Accepted
- Context: Marketing decisions require explainability and trust.
- Decision: AI conclusions should prioritize cited evidence and contextual traceability.
- Consequences: Response contracts and logs must carry evidence metadata.

## ADR-010: Provider-Independent AI Layer
- Status: Accepted
- Context: Vendor lock-in and runtime resiliency require interchangeable AI providers.
- Decision: Maintain provider abstraction for OpenAI and Anthropic integrations.
- Consequences: Provider-specific logic is isolated behind typed interfaces.

## ADR-011: SSRF-Safe Website Fetching
- Status: Accepted
- Context: Website ingestion is needed for Brand Brain and Knowledge Hub but introduces network risk.
- Decision: Enforce SSRF-safe fetch policies, URL validation, and allowlist-oriented controls.
- Consequences: Some URLs/environments may be blocked by policy and need explicit override paths.

## ADR-012: Versioned Brand Brain Data
- Status: Accepted
- Context: Brand context evolves and requires recoverable snapshots and auditability.
- Decision: Store Brand Brain data with explicit versioning semantics.
- Consequences: Update workflows include migration/version transitions rather than in-place opaque mutation.
