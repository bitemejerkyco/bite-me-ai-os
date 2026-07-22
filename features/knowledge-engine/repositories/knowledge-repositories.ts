import type {
  KnowledgeCollection,
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  KnowledgeJob,
  KnowledgeSource,
  KnowledgeSourceType,
  Prisma,
} from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import type { CitationRecord, DocumentChunk, JobTransitionInput } from "@/features/knowledge-engine/types";

export type KnowledgeDocumentInspector = KnowledgeDocument & {
  source: KnowledgeSource | null;
  collection: KnowledgeCollection | null;
  chunks: { id: string; stableKey: string; chunkIndex: number; text: string; pageNumber: number | null; heading: string | null }[];
  jobs: KnowledgeJob[];
  _count: { chunks: number };
};

export interface KnowledgeSourceRepository {
  listSourcesByWorkspace(workspaceId: string): Promise<KnowledgeSource[]>;
}

export interface KnowledgeCollectionRepository {
  listCollectionsByWorkspace(workspaceId: string): Promise<KnowledgeCollection[]>;
  createCollection(input: { workspaceId: string; name: string; slug: string; description?: string }): Promise<KnowledgeCollection>;
}

export interface KnowledgeDocumentRepository {
  listDocumentsByWorkspace(workspaceId: string): Promise<KnowledgeDocument[]>;
  findDocumentById(workspaceId: string, documentId: string): Promise<KnowledgeDocumentInspector | null>;
  findDocumentByChecksum(workspaceId: string, checksum: string): Promise<KnowledgeDocument | null>;
  createQueuedDocument(input: {
    workspaceId: string;
    sourceId?: string | null;
    collectionId?: string | null;
    filename: string;
    originalFilename: string;
    mimeType: string;
    checksum: string;
    sizeBytes: number;
    uploadedById?: string | null;
    storageKey?: string | null;
  }): Promise<KnowledgeDocument>;
  markDocumentArchived(workspaceId: string, documentId: string): Promise<KnowledgeDocument>;
  markDocumentProcessing(workspaceId: string, documentId: string): Promise<KnowledgeDocument>;
  markDocumentFailed(workspaceId: string, documentId: string, reason: string): Promise<KnowledgeDocument>;
  updateDocumentStorageKey(workspaceId: string, documentId: string, storageKey: string): Promise<KnowledgeDocument>;
  markDocumentReady(workspaceId: string, documentId: string, metadata: Prisma.JsonObject): Promise<KnowledgeDocument>;
  countCitationsForDocument(workspaceId: string, documentId: string): Promise<number>;
}

export interface KnowledgeChunkRepository {
  replaceDocumentChunks(workspaceId: string, documentId: string, chunks: DocumentChunk[]): Promise<void>;
}

export interface KnowledgeCitationRepository {
  replaceDocumentCitations(workspaceId: string, documentId: string, citations: CitationRecord[]): Promise<void>;
}

export interface KnowledgeJobRepository {
  createQueuedJob(documentId: string): Promise<KnowledgeJob>;
  transitionJob(workspaceId: string, transition: JobTransitionInput): Promise<KnowledgeJob>;
  latestJobForDocument(workspaceId: string, documentId: string): Promise<KnowledgeJob | null>;
}

export type SearchCandidateRow = {
  documentId: string;
  chunkId: string;
  chunkStableKey: string;
  title: string | null;
  filename: string;
  mimeType: string;
  collectionName: string | null;
  text: string;
  createdAt: string;
  sourceType: KnowledgeSourceType | null;
  status: KnowledgeDocumentStatus;
  uploadedById: string | null;
  citationKeys: string[];
};

export class PrismaKnowledgeRepository
  implements
    KnowledgeSourceRepository,
    KnowledgeCollectionRepository,
    KnowledgeDocumentRepository,
    KnowledgeChunkRepository,
    KnowledgeCitationRepository,
    KnowledgeJobRepository
{
  private prisma = getPrismaClient();

  async listSourcesByWorkspace(workspaceId: string): Promise<KnowledgeSource[]> {
    return this.prisma.knowledgeSource.findMany({ where: { workspaceId }, orderBy: [{ createdAt: "desc" }] });
  }

  async listCollectionsByWorkspace(workspaceId: string): Promise<KnowledgeCollection[]> {
    return this.prisma.knowledgeCollection.findMany({ where: { workspaceId }, orderBy: [{ name: "asc" }] });
  }

  async createCollection(input: { workspaceId: string; name: string; slug: string; description?: string }): Promise<KnowledgeCollection> {
    return this.prisma.knowledgeCollection.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        slug: input.slug,
        description: input.description,
      },
    });
  }

  async listDocumentsByWorkspace(workspaceId: string): Promise<KnowledgeDocument[]> {
    return this.prisma.knowledgeDocument.findMany({ where: { workspaceId }, orderBy: [{ createdAt: "desc" }] });
  }

  async findDocumentById(workspaceId: string, documentId: string): Promise<KnowledgeDocumentInspector | null> {
    return this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, workspaceId },
      include: {
        source: true,
        collection: true,
        chunks: {
          orderBy: [{ chunkIndex: "asc" }],
          select: {
            id: true,
            stableKey: true,
            chunkIndex: true,
            text: true,
            pageNumber: true,
            heading: true,
          },
        },
        jobs: { orderBy: [{ createdAt: "desc" }] },
        _count: { select: { chunks: true } },
      },
    });
  }

  async findDocumentByChecksum(workspaceId: string, checksum: string): Promise<KnowledgeDocument | null> {
    return this.prisma.knowledgeDocument.findFirst({ where: { workspaceId, checksum } });
  }

  async createQueuedDocument(input: {
    workspaceId: string;
    sourceId?: string | null;
    collectionId?: string | null;
    filename: string;
    originalFilename: string;
    mimeType: string;
    checksum: string;
    sizeBytes: number;
    uploadedById?: string | null;
    storageKey?: string | null;
  }): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.create({
      data: {
        workspaceId: input.workspaceId,
        sourceId: input.sourceId,
        collectionId: input.collectionId,
        filename: input.filename,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        checksum: input.checksum,
        sizeBytes: input.sizeBytes,
        uploadedById: input.uploadedById,
        storageKey: input.storageKey,
        status: "QUEUED",
      },
    });
  }

  async markDocumentArchived(workspaceId: string, documentId: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId, workspaceId },
      data: { status: "ARCHIVED" },
    });
  }

  async markDocumentProcessing(workspaceId: string, documentId: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId, workspaceId },
      data: {
        status: "PROCESSING",
        failureReason: null,
        processedAt: null,
      },
    });
  }

  async markDocumentFailed(workspaceId: string, documentId: string, reason: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId, workspaceId },
      data: { status: "FAILED", failureReason: reason },
    });
  }

  async updateDocumentStorageKey(workspaceId: string, documentId: string, storageKey: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId, workspaceId },
      data: { storageKey },
    });
  }

  async markDocumentReady(workspaceId: string, documentId: string, metadata: Prisma.JsonObject): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId, workspaceId },
      data: {
        status: "READY",
        processedAt: new Date(),
        metadata,
        failureReason: null,
      },
    });
  }

  async countCitationsForDocument(workspaceId: string, documentId: string): Promise<number> {
    return this.prisma.knowledgeCitation.count({
      where: {
        chunk: {
          documentId,
          document: { workspaceId },
        },
      },
    });
  }

  async replaceDocumentChunks(workspaceId: string, documentId: string, chunks: DocumentChunk[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({ where: { document: { workspaceId, id: documentId } } });
      if (chunks.length === 0) return;
      await tx.knowledgeChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId,
          chunkIndex: chunk.chunkIndex,
          stableKey: chunk.stableKey,
          text: chunk.text,
          tokenCount: chunk.tokenCount,
          heading: chunk.heading,
          pageNumber: chunk.pageNumber,
          confidence: chunk.confidence,
          metadata: chunk.metadata as Prisma.InputJsonValue | undefined,
          embeddingStatus: chunk.embeddingStatus,
        })),
      });
    });
  }

  async replaceDocumentCitations(workspaceId: string, documentId: string, citations: CitationRecord[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.knowledgeCitation.deleteMany({ where: { chunk: { document: { workspaceId, id: documentId } } } });
      if (!citations.length) return;
      const chunks = await tx.knowledgeChunk.findMany({ where: { documentId }, select: { id: true, stableKey: true } });
      const idByStableKey = new Map(chunks.map((item) => [item.stableKey, item.id]));
      await tx.knowledgeCitation.createMany({
        data: citations
          .map((citation) => {
            const chunkId = idByStableKey.get(citation.chunkStableKey);
            if (!chunkId) return null;
            return {
              chunkId,
              citationKey: citation.citationKey,
              pageNumber: citation.pageNumber,
              section: citation.section,
              sourceText: citation.sourceText,
              confidence: citation.confidence,
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      });
    });
  }

  async createQueuedJob(documentId: string): Promise<KnowledgeJob> {
    return this.prisma.knowledgeJob.create({
      data: {
        documentId,
        status: "QUEUED",
        stage: "UPLOAD",
        progress: 0,
      },
    });
  }

  async transitionJob(workspaceId: string, transition: JobTransitionInput): Promise<KnowledgeJob> {
    const latest = await this.prisma.knowledgeJob.findFirst({
      where: { documentId: transition.documentId, document: { workspaceId } },
      orderBy: { createdAt: "desc" },
    });

    if (!latest) {
      throw new Error("Knowledge job not found.");
    }

    return this.prisma.knowledgeJob.update({
      where: { id: latest.id },
      data: {
        status: transition.status,
        stage: transition.stage,
        progress: transition.progress,
        errorCode: transition.errorCode,
        errorMessage: transition.errorMessage,
        startedAt: transition.status === "RUNNING" && !latest.startedAt ? new Date() : latest.startedAt,
        completedAt: transition.status === "COMPLETED" || transition.status === "FAILED" ? new Date() : null,
      },
    });
  }

  async latestJobForDocument(workspaceId: string, documentId: string): Promise<KnowledgeJob | null> {
    return this.prisma.knowledgeJob.findFirst({
      where: { documentId, document: { workspaceId } },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async searchCandidates(params: {
    workspaceId: string;
    collectionId?: string;
    sourceType?: KnowledgeSourceType;
    mimeType?: string;
    status?: KnowledgeDocumentStatus;
    uploadedById?: string;
    createdFrom?: Date;
    createdTo?: Date;
  }): Promise<SearchCandidateRow[]> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        workspaceId: params.workspaceId,
        collectionId: params.collectionId,
        mimeType: params.mimeType,
        status: params.status,
        uploadedById: params.uploadedById,
        source: params.sourceType ? { type: params.sourceType } : undefined,
        createdAt:
          params.createdFrom || params.createdTo
            ? {
                gte: params.createdFrom,
                lte: params.createdTo,
              }
            : undefined,
      },
      include: {
        source: { select: { type: true } },
        collection: { select: { name: true } },
        chunks: {
          include: { citations: { select: { citationKey: true } } },
          orderBy: [{ chunkIndex: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return documents.flatMap((document) =>
      document.chunks.map((chunk) => ({
        documentId: document.id,
        chunkId: chunk.id,
        chunkStableKey: chunk.stableKey,
        title: document.title,
        filename: document.filename,
        mimeType: document.mimeType,
        collectionName: document.collection?.name || null,
        text: chunk.text,
        createdAt: document.createdAt.toISOString(),
        sourceType: document.source?.type || null,
        status: document.status,
        uploadedById: document.uploadedById,
        citationKeys: chunk.citations.map((citation) => citation.citationKey),
      }))
    );
  }
}
