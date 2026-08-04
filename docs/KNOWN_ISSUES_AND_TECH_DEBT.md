# Known Issues and Technical-Debt Register

These items combine historical findings and required audits.

## Critical verification

### Database migration reconciliation

Historical work restored and reordered Supabase migrations, including video-router/workflow migrations and a legacy duration backfill before a constraint. Verify:

- Local migration files
- Remote migration history
- Constraint validation state
- Legacy 16/20-second rows
- Production schema parity

### Video duration constraints

A migration was reportedly changed to backfill before constraint enforcement and use `NOT VALID` during transition. Confirm final constraint state and whether all legacy records are valid.

### Credit idempotency

Confirm reservation, consumption, failure refund, retry, and duplicate-request behavior. Add concurrency tests.

### Tenant isolation

Audit every tenant-owned table and storage path for RLS and server-side ownership checks.

### Social tokens

Confirm encryption/storage, refresh behavior, expiration handling, revocation, and logs.

## High priority

### README is generic

The repository README historically remained the default Next.js starter document. Replace it with accurate setup, architecture, validation, and deployment instructions.

### UX fragmentation

Historical user feedback: the process was not fluid and required too many separate decisions. Audit duplicate creation entry points and inconsistent actions.

### Video progress

Confirm progress reflects durable job states and does not freeze or falsely complete.

### Calendar overflow

A previous issue made “+1 more” scheduled items inaccessible. Verify regression tests and mobile behavior.

### Folder semantics

Confirm moving assets removes them from user-defined prior folders while keeping “All Assets” semantics clear.

### Ask Motive naming

Search all UI, metadata, accessibility labels, notifications, email templates, and help copy for retired names:
- Ask PostMotive
- Ask PostMotive Knowledge
- PostMotive Knowledge
- Knowledge Assistant
- Ask Knowledge

### Help registry

Run `npm run validate:help` and confirm every registered page and help target is current.

## Medium priority

- Loading/error/empty states across all workflows
- Consistent content statuses
- Provider-neutral generation adapters
- Centralized compliance checks
- Analytics data provenance
- Mobile editor usability
- Rate limiting for expensive endpoints
- Webhook verification and replay protection
- Structured logs and job correlation
- Test fixtures for demo accounts
- Admin audit logging

## Investigation template

For each issue record:

- Reproduction steps
- Expected behavior
- Actual behavior
- Affected route/files
- Root cause
- Data risk
- Security risk
- Cost risk
- Fix
- Tests
- Migration/deployment requirements
