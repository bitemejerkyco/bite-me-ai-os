# PostMotive AI Master Product Requirements Document

Product: PostMotive AI

Tagline: Every Post Has a Motive.

## Product Vision
PostMotive AI is a marketing operations platform that helps teams move from disconnected campaign work to an intentional, evidence-backed publishing system where strategy, brand context, execution, and analytics stay in one workflow.

## Target Users
- In-house marketing teams at SMB and mid-market brands
- Agency teams managing multiple client workspaces
- Content strategists and social managers who need consistent brand output
- Marketing leaders who need traceable performance and approvals

## Product Principles
- Evidence-first outputs over unsupported AI guesses
- Workspace-first security and authorization boundaries
- Human-in-the-loop approvals for high-impact publishing
- Provider-independent AI orchestration with fallback support
- Incremental shipping with explicit Implemented, Planned, and Proposed states

## Capability Status Map

### Mission Control
Status: Implemented

Mission Control provides the dashboard shell, setup posture, navigation, and readiness feedback.

### Brand Brain
Status: Planned

Brand Brain foundation, versioning, and ingestion lifecycle are defined but not fully implemented in this sprint.

### Knowledge Hub
Status: Planned

Knowledge ingestion, source management, and retrieval pipelines are planned.

### AI Employees
Status: Planned

Role-based AI operators and orchestration controls are planned.

### Content Studio
Status: Planned

Drafting, refinement, and channel-specific packaging are planned.

### Campaigns
Status: Planned

Campaign planning, execution tracking, and lifecycle automation are planned.

### Calendar and Publishing
Status: Planned

Calendar management, scheduling, and publishing connectors are planned.

### Analytics
Status: Planned

Performance dashboards, attribution views, and operational analytics are planned.

### Approvals
Status: Proposed

Approval workflows, decision audit trails, and role-based sign-off are proposed for later phases.

### Billing
Status: Planned

Subscription and workspace billing controls are planned at foundation level.

### Agency Mode
Status: Proposed

Agency multi-workspace workflows and client context partitioning are proposed.

### Security
Status: Implemented and Planned

Implemented: baseline environment validation, server-side auth foundation, and CI security checks.
Planned: expanded policy enforcement, secrets posture hardening, and production security controls.

## Technical Architecture
- Next.js App Router with Server Components by default
- TypeScript strict mode
- Feature-first modules
- Prisma with PostgreSQL production target
- Supabase SSR authentication foundation
- Provider abstraction for OpenAI and Anthropic integration paths
- Zod validation for runtime and external inputs
- Structured logging and standardized API response helpers

## MVP Definition
MVP includes:
- Mission Control dashboard shell
- Environment readiness indicators
- Workspace/member/domain schema foundation
- Supabase authentication setup mode and core user abstraction
- Feature scaffolding for Brand Brain, Knowledge Hub, AI Employees, Content Studio, Campaigns, Calendar, and Analytics
- CI, baseline tests, and security workflow

MVP does not yet include:
- Full Brand Brain intelligence workflows
- Full Knowledge Hub ingestion/retrieval
- Publishing integrations
- Advanced billing and approvals

## Release Roadmap
- Phase A (Current): Platform foundation stabilization and architectural hardening
- Phase B: Brand Brain data lifecycle and knowledge ingestion foundation
- Phase C: Campaign/content workflows and publishing orchestration
- Phase D: Analytics depth, approvals, and billing maturation
- Phase E: Agency mode and advanced multi-workspace controls

## Risks
- AI provider variability and output quality drift
- Data model evolution risk as Brand Brain requirements expand
- Authorization complexity across workspace and agency scenarios
- Integration risk for external publishing APIs
- Cost control risk for AI generation workloads

## Open Decisions
- Canonical role matrix for approvals and delegated publishing
- Queue/worker runtime selection for asynchronous execution
- Provider routing policy defaults between OpenAI and Anthropic
- Knowledge source sync intervals and conflict resolution

## Definition of Done
- Required architecture, docs, and decision records exist in repository
- Mission Control behavior remains intact after refactor
- Shared infra utilities include validation, redaction, and typed responses
- Prisma schema and initial migration validate and generate successfully
- Auth foundation compiles in setup mode without Supabase credentials
- Baseline tests pass
- CI and security workflows execute expected checks
