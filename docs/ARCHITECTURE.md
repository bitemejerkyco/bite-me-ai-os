# Architecture

LaunchAI uses Next.js App Router, React, TypeScript, Tailwind CSS, Supabase and OpenAI.

- `app/` routes and server actions
- `components/` shared interface components
- `lib/agents/` specialist AI agents
- `lib/orchestrators/` coordinated workflows
- `lib/brand/` structured brand types and context
- `supabase/` database migrations

## Knowledge Engine Foundation (Sprint 3A)

- `config/knowledge-engine.ts`: central limits, supported MIME types/extensions, and feature flags.
- `features/knowledge-engine/types/`: domain contracts for extraction, normalization, chunking, citation, search, and connector workflows.
- `features/knowledge-engine/connectors/`: connector abstractions with upload connector and placeholder external connectors.
- `features/knowledge-engine/processors/`: pluggable extraction processors (txt, md, csv, pdf, docx, pptx, xlsx, image metadata).
- `features/knowledge-engine/services/`: ingestion pipeline, workspace auth context, normalization, chunking, citation, and search query orchestration.
- `features/knowledge-engine/repositories/`: Prisma-backed repository layer for sources, collections, documents, chunks, citations, jobs, and search candidates.
- `features/knowledge-engine/storage/`: storage abstraction with local file storage implementation under `.knowledge-storage/`.
- `app/api/knowledge-engine/*`: workspace-scoped API routes for collections, document list/detail, upload, retry, archive, and search.
- `app/(dashboard)/knowledge-hub/page.tsx`: operational UI for collection navigation, upload, search, document table, and right-side inspector.

### Runtime Flow

1. Upload route validates file metadata/signature and authorizes workspace role.
2. Ingestion service queues document and job, persists binary content, selects processor, and extracts content.
3. Extraction result is normalized and split into stable chunks.
4. Citation keys are generated and chunk/citation records are persisted.
5. Document/job status transitions to `READY` or `FAILED`, and inspector endpoints expose operational details.

### Operational Constraints

- Processing is synchronous and request-bound in Sprint 3A.
- Private local storage is appropriate for development but not distributed production deployments.
- Placeholder connectors are explicit non-functional stubs and must not be treated as active integrations.
