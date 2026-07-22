# Knowledge Engine

## Status
Implemented in Sprint 3A as a request-bound uploaded-file ingestion foundation for workspace-scoped knowledge storage, search, and inspection.

## Implemented
- Prisma data model for knowledge sources, collections, documents, chunks, citations, and jobs
- Connector registry with working upload connector
- Explicit placeholder connectors for website, Google Drive, Dropbox, OneDrive, Notion, GitHub, and RSS
- Processor registry with TXT, Markdown, CSV, PDF, DOCX, PPTX, XLSX, PNG, JPEG, and WEBP handling
- Upload validation with filename sanitization, blocked-extension policy, MIME checks, and SHA-256 checksum generation
- Local private development storage under the configured knowledge storage root
- Deterministic normalization, chunking, stable chunk keys, and citation generation
- Workspace-scoped lexical search over stored chunks
- Request-bound synchronous ingestion pipeline with job status transitions
- API routes for collections, document list/detail, upload, retry, archive, and search
- Knowledge Hub UI for upload, search, collection navigation, document listing, and document inspection

## Planned
- Background queue workers
- Cloud object storage
- Website ingestion and sync
- Google Drive sync
- Dropbox sync
- OneDrive sync
- Notion sync
- GitHub sync
- OCR
- Vector search
- Hybrid retrieval
- AI Employee retrieval integration

## Connector Status
Working connector:
- Upload

Placeholder connectors:
- Website
- Google Drive
- Dropbox
- OneDrive
- Notion
- GitHub
- RSS

Placeholder connectors are intentionally non-functional and return explicit unsupported or not-configured responses.

## Supported File Types
- .txt
- .md
- .csv
- .pdf
- .docx
- .pptx
- .xlsx
- .png
- .jpg
- .jpeg
- .webp

## Limits and Safety Controls
- Maximum upload size: 20 MB by default
- Maximum extracted characters: 300000
- Maximum upload filename length: 180
- Citation excerpt cap: 320 characters
- Search snippet cap: 280 characters
- PDF page cap: 300 pages
- Spreadsheet sheet cap: 20 sheets
- Spreadsheet row cap: 2000 rows per sheet
- Spreadsheet cell cap: 60 cells per row
- Presentation slide cap: 250 slides
- Blocked executable and archive extensions including .exe, .bat, .cmd, .ps1, .sh, .zip, .tar, .gz, .rar, and .7z
- No shell-based document conversion
- No arbitrary URL fetching in Sprint 3A
- No OCR execution in Sprint 3A
- No public storage path exposure in API responses
- No secret logging in ingestion flows

## Storage
Development storage uses a private local filesystem root configured by `KNOWLEDGE_LOCAL_STORAGE_ROOT`, defaulting to `.knowledge-storage` beneath the project root. Stored file keys are sanitized and protected against traversal.

This local storage mode is intended for development only and is not suitable for distributed production deployments.

## Processing Flow
1. Validate metadata, MIME policy, extension policy, and file signature.
2. Persist the binary file privately.
3. Select a processor by MIME type or extension fallback.
4. Extract text or metadata deterministically.
5. Normalize extracted content.
6. Split content into deterministic chunks with stable keys.
7. Generate bounded citations with locators.
8. Persist chunks, citations, and job status.
9. Expose document state through workspace-scoped API routes and the Knowledge Hub UI.

## Commands
Install dependencies:
```bash
npm install
```

Format and validate Prisma:
```bash
npx prisma format
npx prisma validate
npx prisma generate
```

Create a migration with a reachable PostgreSQL database:
```bash
npm run db:migrate -- --name 20260721_knowledge_engine_foundation
```

If no development PostgreSQL database is reachable, an offline schema diff can be generated from the foundation schema baseline for review, but migration status checks still require a real PostgreSQL database.
