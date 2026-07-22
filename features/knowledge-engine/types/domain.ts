import type {
  KnowledgeDocumentStatus,
  KnowledgeEmbeddingStatus,
  KnowledgeJobStage,
  KnowledgeJobStatus,
  KnowledgeSourceType,
  KnowledgeSyncStatus,
} from "@prisma/client";

export type SupportedKnowledgeMimeType =
  | "text/plain"
  | "text/markdown"
  | "text/csv"
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export type KnowledgeSourceInput = {
  workspaceId: string;
  type: KnowledgeSourceType;
  provider: string;
  externalId?: string | null;
  displayName: string;
  syncStatus?: KnowledgeSyncStatus;
  metadata?: Record<string, unknown> | null;
};

export type KnowledgeDocumentInput = {
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
  metadata?: Record<string, unknown> | null;
};

export type KnowledgeFile = {
  filename: string;
  originalFilename: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  checksum?: string;
  metadata?: Record<string, unknown>;
};

export type ProcessingWarning = {
  code: string;
  message: string;
  locator?: {
    pageNumber?: number;
    section?: string;
    sheet?: string;
    slideNumber?: number;
    rowNumber?: number;
  };
};

export type ExtractedSection = {
  id: string;
  heading?: string;
  text: string;
  order: number;
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  rowNumber?: number;
  metadata?: Record<string, unknown>;
};

export type ExtractedPage = {
  pageNumber: number;
  text: string;
  sections: ExtractedSection[];
};

export type ExtractionResult = {
  processorId: string;
  processorVersion: string;
  mimeType: string;
  filename: string;
  title?: string;
  author?: string;
  company?: string;
  language?: string;
  fullText: string;
  pages: ExtractedPage[];
  sections: ExtractedSection[];
  warnings: ProcessingWarning[];
  metadata?: Record<string, unknown>;
};

export type NormalizedSection = {
  id: string;
  heading?: string;
  text: string;
  order: number;
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  rowNumber?: number;
  metadata?: Record<string, unknown>;
};

export type NormalizedDocument = {
  title?: string;
  author?: string;
  company?: string;
  language?: string;
  completeText: string;
  sections: NormalizedSection[];
  metadata: Record<string, unknown>;
  warnings: ProcessingWarning[];
  sourceFilename: string;
  mimeType: string;
  extractedAt: string;
  processorId: string;
  processorVersion: string;
};

export type DocumentChunk = {
  chunkIndex: number;
  stableKey: string;
  text: string;
  tokenCount: number;
  heading?: string;
  pageNumber?: number;
  confidence: number;
  metadata?: Record<string, unknown>;
  embeddingStatus: KnowledgeEmbeddingStatus;
};

export type CitationRecord = {
  citationKey: string;
  chunkStableKey: string;
  chunkIndex: number;
  pageNumber?: number;
  section?: string;
  sourceText: string;
  confidence: number;
  collectionId?: string | null;
};

export type EvidenceReference = {
  citationKey: string;
  chunkId: string;
  documentId: string;
  excerpt: string;
  locator?: {
    pageNumber?: number;
    section?: string;
  };
  confidence: number;
};

export type ProcessingResult = {
  documentStatus: KnowledgeDocumentStatus;
  extraction: ExtractionResult;
  normalized: NormalizedDocument;
  chunks: DocumentChunk[];
  citations: CitationRecord[];
  warnings: ProcessingWarning[];
};

export type SearchFilters = {
  workspaceId: string;
  collectionId?: string;
  sourceType?: KnowledgeSourceType;
  mimeType?: string;
  status?: KnowledgeDocumentStatus;
  uploadedById?: string;
  createdFrom?: string;
  createdTo?: string;
};

export type SearchQuery = {
  term: string;
  page: number;
  pageSize: number;
  filters: SearchFilters;
};

export type SearchResultItem = {
  documentId: string;
  chunkId: string;
  chunkStableKey: string;
  title?: string | null;
  filename: string;
  mimeType: string;
  collectionName?: string | null;
  score: number;
  snippet: string;
  citationKeys: string[];
  createdAt: string;
};

export type SearchResult = {
  total: number;
  page: number;
  pageSize: number;
  items: SearchResultItem[];
};

export type UploadValidationResult =
  | {
      ok: true;
      sanitizedFilename: string;
      normalizedExtension: string;
      mimeType: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type ConnectorSourceDescriptor = {
  id: string;
  displayName: string;
  sourceType: KnowledgeSourceType;
  provider: string;
  metadata?: Record<string, unknown>;
};

export type ConnectorSyncResult = {
  status: "ready" | "not-configured" | "unsupported" | "failed";
  syncedCount: number;
  message?: string;
  warnings?: ProcessingWarning[];
};

export type ConnectorIngestInput = {
  workspaceId: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  file?: KnowledgeFile;
};

export type ConnectorIngestResult = {
  status: "ready" | "not-configured" | "unsupported" | "failed";
  files: KnowledgeFile[];
  message?: string;
};

export type ConnectorSyncContext = {
  workspaceId: string;
  sourceId: string;
};

export type JobTransitionInput = {
  documentId: string;
  status: KnowledgeJobStatus;
  stage: KnowledgeJobStage;
  progress: number;
  errorCode?: string;
  errorMessage?: string;
};
