-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('UPLOAD', 'WEBSITE', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'NOTION', 'CONFLUENCE', 'GITHUB', 'RSS', 'API', 'MANUAL');

-- CreateEnum
CREATE TYPE "KnowledgeSyncStatus" AS ENUM ('IDLE', 'QUEUED', 'SYNCING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeJobStage" AS ENUM ('UPLOAD', 'VALIDATE', 'EXTRACT', 'NORMALIZE', 'CHUNK', 'INDEX', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeEmbeddingStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "displayName" TEXT NOT NULL,
    "syncStatus" "KnowledgeSyncStatus" NOT NULL DEFAULT 'IDLE',
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeCollection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT,
    "collectionId" TEXT,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "language" TEXT,
    "title" TEXT,
    "author" TEXT,
    "company" TEXT,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'QUEUED',
    "storageKey" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "stableKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "heading" TEXT,
    "pageNumber" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "embeddingStatus" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeCitation" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "citationKey" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "section" TEXT,
    "sourceText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "KnowledgeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "KnowledgeJobStage" NOT NULL DEFAULT 'UPLOAD',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeSource_workspaceId_idx" ON "KnowledgeSource"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeSource_type_idx" ON "KnowledgeSource"("type");

-- CreateIndex
CREATE INDEX "KnowledgeSource_provider_idx" ON "KnowledgeSource"("provider");

-- CreateIndex
CREATE INDEX "KnowledgeSource_externalId_idx" ON "KnowledgeSource"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSource_workspaceId_provider_externalId_key" ON "KnowledgeSource"("workspaceId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "KnowledgeCollection_workspaceId_idx" ON "KnowledgeCollection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeCollection_workspaceId_slug_key" ON "KnowledgeCollection"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_checksum_idx" ON "KnowledgeDocument"("checksum");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_workspaceId_idx" ON "KnowledgeDocument"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_sourceId_idx" ON "KnowledgeDocument"("sourceId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_collectionId_idx" ON "KnowledgeDocument"("collectionId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_stableKey_key" ON "KnowledgeChunk"("stableKey");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_embeddingStatus_idx" ON "KnowledgeChunk"("embeddingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON "KnowledgeChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeCitation_citationKey_key" ON "KnowledgeCitation"("citationKey");

-- CreateIndex
CREATE INDEX "KnowledgeCitation_chunkId_idx" ON "KnowledgeCitation"("chunkId");

-- CreateIndex
CREATE INDEX "KnowledgeJob_documentId_idx" ON "KnowledgeJob"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeJob_status_idx" ON "KnowledgeJob"("status");

-- CreateIndex
CREATE INDEX "KnowledgeJob_stage_idx" ON "KnowledgeJob"("stage");

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCollection" ADD CONSTRAINT "KnowledgeCollection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "KnowledgeCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCitation" ADD CONSTRAINT "KnowledgeCitation_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeJob" ADD CONSTRAINT "KnowledgeJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
