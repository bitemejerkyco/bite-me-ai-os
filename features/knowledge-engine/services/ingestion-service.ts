import { logger } from "@/lib/logger";
import { DocumentNormalizationService } from "@/features/knowledge-engine/services/normalization-service";
import { ChunkingService } from "@/features/knowledge-engine/services/chunking-service";
import { CitationService } from "@/features/knowledge-engine/services/citation-service";
import { validateUploadFile, toKnowledgeFile } from "@/features/knowledge-engine/upload/validation";
import { PrismaKnowledgeRepository } from "@/features/knowledge-engine/repositories/knowledge-repositories";
import { createDefaultProcessorRegistry } from "@/features/knowledge-engine/processors/default-processors";
import { createDefaultConnectorRegistry } from "@/features/knowledge-engine/connectors/default-connectors";
import { LocalKnowledgeFileStorage } from "@/features/knowledge-engine/storage/local-storage";
import type { ProcessingResult } from "@/features/knowledge-engine/types";

function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    if (error.message === "AUTH_SETUP_REQUIRED") return { code: "AUTH_SETUP_REQUIRED", message: "Authentication setup is required." };
    if (error.message === "AUTH_REQUIRED") return { code: "AUTH_REQUIRED", message: "You must be signed in." };
    if (error.message === "WORKSPACE_ACCESS_DENIED") return { code: "WORKSPACE_ACCESS_DENIED", message: "You do not have access to this workspace." };
    if (error.message === "WORKSPACE_ROLE_DENIED") return { code: "WORKSPACE_ROLE_DENIED", message: "Insufficient permissions for this action." };
    if (error.message === "WORKSPACE_NOT_FOUND") return { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found." };
  }
  return { code: "INGESTION_FAILED", message: "Document processing failed." };
}

export class KnowledgeIngestionService {
  private readonly repository = new PrismaKnowledgeRepository();
  private readonly processorRegistry = createDefaultProcessorRegistry();
  private readonly connectorRegistry = createDefaultConnectorRegistry();
  private readonly normalization = new DocumentNormalizationService();
  private readonly chunking = new ChunkingService();
  private readonly citation = new CitationService();
  private readonly storage = new LocalKnowledgeFileStorage();

  private async processStoredDocument(input: {
    workspaceId: string;
    documentId: string;
    collectionId?: string | null;
    filename: string;
    mimeType: string;
    checksum: string;
    bytes: Uint8Array;
  }): Promise<ProcessingResult> {
    await this.repository.markDocumentProcessing(input.workspaceId, input.documentId);
    await this.repository.createQueuedJob(input.documentId);

    try {
      await this.repository.transitionJob(input.workspaceId, {
        documentId: input.documentId,
        status: "RUNNING",
        stage: "VALIDATE",
        progress: 10,
      });

      await this.repository.transitionJob(input.workspaceId, {
        documentId: input.documentId,
        status: "RUNNING",
        stage: "EXTRACT",
        progress: 30,
      });

      const processor = this.processorRegistry.resolve({
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.bytes.byteLength,
        bytes: input.bytes,
      });
      if (!processor) {
        throw new Error("UNSUPPORTED_PROCESSOR:No processor is available for this file format.");
      }

      const extracted = await processor.extract({
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.bytes.byteLength,
        bytes: input.bytes,
      });

      await this.repository.transitionJob(input.workspaceId, {
        documentId: input.documentId,
        status: "RUNNING",
        stage: "NORMALIZE",
        progress: 45,
      });

      const normalized = this.normalization.normalize(extracted);

      await this.repository.transitionJob(input.workspaceId, {
        documentId: input.documentId,
        status: "RUNNING",
        stage: "CHUNK",
        progress: 60,
      });

      const chunks = this.chunking.chunkDocument({
        documentChecksum: input.checksum || input.documentId,
        normalized,
      });

      const citations = this.citation.createCitations({
        documentId: input.documentId,
        collectionId: input.collectionId,
        chunks,
      });

      await this.repository.transitionJob(input.workspaceId, {
        documentId: input.documentId,
        status: "RUNNING",
        stage: "INDEX",
        progress: 80,
      });

      await this.repository.replaceDocumentChunks(input.workspaceId, input.documentId, chunks);
      await this.repository.replaceDocumentCitations(input.workspaceId, input.documentId, citations);
      await this.repository.markDocumentReady(input.workspaceId, input.documentId, {
        processorId: extracted.processorId,
        processorVersion: extracted.processorVersion,
        warningCount: normalized.warnings.length,
      });

      await this.repository.transitionJob(input.workspaceId, {
        documentId: input.documentId,
        status: "COMPLETED",
        stage: "COMPLETE",
        progress: 100,
      });

      return {
        documentStatus: "READY",
        extraction: extracted,
        normalized,
        chunks,
        citations,
        warnings: normalized.warnings,
      };
    } catch (error) {
      const safe = safeError(error);
      logger.error("Knowledge ingestion failed", {
        documentId: input.documentId,
        workspaceId: input.workspaceId,
        code: safe.code,
        reason: error instanceof Error ? error.message : "unknown",
      });

      await this.repository.markDocumentFailed(input.workspaceId, input.documentId, safe.message);
      await this.repository.transitionJob(input.workspaceId, {
        documentId: input.documentId,
        status: "FAILED",
        stage: "FAILED",
        progress: 100,
        errorCode: safe.code,
        errorMessage: safe.message,
      });

      throw new Error(`${safe.code}:${safe.message}`);
    }
  }

  async ingestUpload(input: {
    workspaceId: string;
    uploadedById: string;
    sourceId?: string;
    collectionId?: string;
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
    allowDuplicateChecksum?: boolean;
  }): Promise<ProcessingResult> {
    const validation = validateUploadFile({
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      bytes: input.bytes,
    });

    if (!validation.ok) {
      throw new Error(`${validation.code}:${validation.message}`);
    }

    const uploadConnector = this.connectorRegistry.getById("upload");
    if (!uploadConnector) {
      throw new Error("Upload connector is not registered.");
    }

    const knowledgeFile = toKnowledgeFile({
      filename: validation.sanitizedFilename,
      mimeType: validation.mimeType,
      bytes: input.bytes,
    });

    const duplicate = await this.repository.findDocumentByChecksum(input.workspaceId, knowledgeFile.checksum || "");
    if (duplicate && !input.allowDuplicateChecksum) {
      throw new Error("DUPLICATE_CHECKSUM:This document already exists in this workspace.");
    }

    const queuedDoc = await this.repository.createQueuedDocument({
      workspaceId: input.workspaceId,
      sourceId: input.sourceId,
      collectionId: input.collectionId,
      filename: knowledgeFile.filename,
      originalFilename: knowledgeFile.originalFilename,
      mimeType: knowledgeFile.mimeType,
      checksum: knowledgeFile.checksum || "",
      sizeBytes: knowledgeFile.sizeBytes,
      uploadedById: input.uploadedById,
    });

    let stored;
    try {
      stored = await this.storage.save({
        workspaceId: input.workspaceId,
        documentId: queuedDoc.id,
        filename: knowledgeFile.filename,
        bytes: knowledgeFile.bytes,
        mimeType: knowledgeFile.mimeType,
      });
    } catch (error) {
      const safe = safeError(error);
      logger.error("Knowledge ingestion failed", {
        documentId: queuedDoc.id,
        workspaceId: input.workspaceId,
        code: safe.code,
        reason: error instanceof Error ? error.message : "unknown",
      });

      await this.repository.markDocumentFailed(input.workspaceId, queuedDoc.id, safe.message);
      await this.repository.transitionJob(input.workspaceId, {
        documentId: queuedDoc.id,
        status: "FAILED",
        stage: "FAILED",
        progress: 100,
        errorCode: safe.code,
        errorMessage: safe.message,
      });

      throw new Error(`${safe.code}:${safe.message}`);
    }

    await this.repository.updateDocumentStorageKey(input.workspaceId, queuedDoc.id, stored.storageKey);
    return this.processStoredDocument({
      workspaceId: input.workspaceId,
      documentId: queuedDoc.id,
      collectionId: input.collectionId,
      filename: knowledgeFile.filename,
      mimeType: knowledgeFile.mimeType,
      checksum: knowledgeFile.checksum || queuedDoc.id,
      bytes: knowledgeFile.bytes,
    });
  }

  async retryStoredDocument(input: {
    workspaceId: string;
    documentId: string;
  }): Promise<ProcessingResult> {
    const document = await this.repository.findDocumentById(input.workspaceId, input.documentId);
    if (!document || !document.storageKey) {
      throw new Error("RETRY_UNAVAILABLE:No stored file is available for retry.");
    }

    const bytes = new Uint8Array(await this.storage.read(document.storageKey));
    return this.processStoredDocument({
      workspaceId: input.workspaceId,
      documentId: document.id,
      collectionId: document.collectionId,
      filename: document.originalFilename,
      mimeType: document.mimeType,
      checksum: document.checksum,
      bytes,
    });
  }
}
