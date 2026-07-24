# PostMotive AI

Every Post Has a Motive.

PostMotive AI is a production-oriented marketing operations platform foundation built on Next.js App Router, TypeScript, Tailwind, Prisma, and Supabase SSR auth patterns.

## Current Implementation Status
- Implemented: Mission Control dashboard shell and responsive navigation
- Implemented: setup-safe auth and environment posture checks
- Implemented: foundational Prisma schema for users, workspaces, memberships, and brands
- Implemented: Knowledge Engine Sprint 3A foundation for uploaded-file ingestion, chunking, citation generation, lexical search, and Knowledge Hub inspection
- Planned: Brand Brain intelligence workflows
- Planned: background queues, cloud storage, OCR, vector retrieval, hybrid retrieval, and external knowledge-source synchronization
- Planned: AI Employees, Content Studio, Campaign execution, publishing, analytics, and billing depth

## Local Setup
1. Install dependencies:

```bash
npm install
```

2. Copy environment placeholders:

```bash
cp .env.example .env.local
```

3. Start development:

```bash
npm run dev
```

## Environment Setup
Set values in .env.local as needed:

- DATABASE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- ANTHROPIC_API_KEY

The app builds without Supabase and database values, but it runs in setup mode for auth and persistence workflows.

## Database Commands
```bash
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

Sprint 3A migration target:

```bash
npm run db:migrate -- --name 20260721_knowledge_engine_foundation
```

Knowledge Engine migration status checks require a reachable PostgreSQL database. Local private file storage does not.

## Validation Commands
```bash
npm run lint
npm run typecheck
npm test
npm run build
npx prisma format
npx prisma validate
npx prisma generate
```

## Product and Architecture Docs
- PRD: POSTMOTIVE_MASTER_PRD.md
- Build Plan: MASTER_BUILD_PLAN.md
- Architecture: ARCHITECTURE.md
- Decisions: DECISIONS.md
- Brand Brain spec: docs/brand-brain-specification.md
- Knowledge Engine spec: docs/knowledge-engine.md

## Knowledge Engine Summary
- Supported file types: txt, md, csv, pdf, docx, pptx, xlsx, png, jpg, jpeg, webp
- Local private development storage root: `.knowledge-storage`
- Default upload limit: 20 MB
- Default extraction limit: 300000 characters
- Spreadsheet safety limits: 20 sheets, 2000 rows per sheet, 60 cells per row
- PDF safety limit: 300 pages

Local private storage is for development only and is not suitable for distributed production deployments.

## Security Reporting
Security contact and vulnerability disclosure policy placeholder:
security@postmotive.example
