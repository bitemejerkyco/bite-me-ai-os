import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import { ConnectorRegistry } from "@/features/knowledge-engine/connectors/registry";
import { UploadConnector, createPlaceholderConnector } from "@/features/knowledge-engine/connectors/upload-connector";
import { ProcessorRegistry } from "@/features/knowledge-engine/processors/registry";
import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";
import { validateUploadFile } from "@/features/knowledge-engine/upload/validation";
import { DocumentNormalizationService } from "@/features/knowledge-engine/services/normalization-service";
import { ChunkingService } from "@/features/knowledge-engine/services/chunking-service";
import { CitationService } from "@/features/knowledge-engine/services/citation-service";
import { LocalKnowledgeFileStorage } from "@/features/knowledge-engine/storage/local-storage";
import { KnowledgeSearchService } from "@/features/knowledge-engine/search/search-service";
import { KnowledgeQueryService } from "@/features/knowledge-engine/services/query-service";
import { KnowledgeIngestionService } from "@/features/knowledge-engine/services/ingestion-service";
import type { ExtractionResult, NormalizedDocument } from "@/features/knowledge-engine/types";

function createExtractionResult(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    processorId: "text",
    processorVersion: "1.0.0",
    mimeType: "text/plain",
    filename: "notes.txt",
    title: "Notes",
    fullText: "Line 1\n\nLine 2",
    pages: [{ pageNumber: 1, text: "Line 1\n\nLine 2", sections: [] }],
    sections: [
      {
        id: "section-1",
        heading: "Heading",
        text: "Line 1\r\n\r\nLine 2",
        order: 0,
        pageNumber: 1,
        metadata: { source: "unit-test" },
      },
    ],
    warnings: [],
    metadata: { source: "unit-test" },
    ...overrides,
  };
}

function createNormalizedDocument(overrides: Partial<NormalizedDocument> = {}): NormalizedDocument {
  return {
    title: "Doc",
    completeText: "Paragraph one. Paragraph two.",
    metadata: {},
    warnings: [],
    sourceFilename: "doc.txt",
    mimeType: "text/plain",
    extractedAt: "2026-07-21T00:00:00.000Z",
    processorId: "text",
    processorVersion: "1.0.0",
    sections: [
      {
        id: "sec-1",
        order: 0,
        heading: "Heading",
        text: "Paragraph one. Paragraph two.",
        pageNumber: 1,
      },
    ],
    ...overrides,
  };
}

class StubProcessor implements DocumentProcessor {
  constructor(
    readonly id: string,
    readonly supportedMimeTypes: readonly string[],
    readonly supportedExtensions: readonly string[]
  ) {}

  readonly version = "1.0.0";

  supports(input: ProcessorInput): boolean {
    return this.supportedMimeTypes.includes(input.mimeType) || this.supportedExtensions.some((ext) => input.filename.endsWith(`.${ext}`));
  }

  async extract(): Promise<ExtractionResult> {
    return createExtractionResult();
  }
}

describe("knowledge engine connectors", () => {
  it("registers and resolves connectors deterministically", () => {
    const registry = new ConnectorRegistry();
    const upload = new UploadConnector();
    const placeholder = createPlaceholderConnector({ id: "github", name: "GitHub", sourceType: "GITHUB", configured: false });

    registry.register(upload);
    registry.register(placeholder);

    expect(registry.getById("upload")).toBe(upload);
    expect(registry.getBySourceType("UPLOAD").map((connector) => connector.id)).toEqual(["upload"]);
    expect(registry.list().map((connector) => connector.id)).toEqual(["github", "upload"]);
  });

  it("rejects duplicate connector ids and reports unsupported placeholders", async () => {
    const registry = new ConnectorRegistry();
    registry.register(new UploadConnector());

    expect(() => registry.register(new UploadConnector())).toThrow(/already registered/i);

    const placeholder = createPlaceholderConnector({ id: "website", name: "Website Connector", sourceType: "WEBSITE", configured: true });
    await expect(placeholder.ingest({ workspaceId: "ws_1" })).resolves.toMatchObject({ status: "unsupported" });
  });
});

describe("knowledge engine processor registry", () => {
  it("resolves by MIME type and then extension fallback", () => {
    const registry = new ProcessorRegistry();
    const markdown = new StubProcessor("markdown", ["text/markdown"], ["md"]);
    const csv = new StubProcessor("csv", ["text/csv"], ["csv"]);

    registry.register(markdown);
    registry.register(csv);

    expect(
      registry.resolve({ filename: "brief.unknown", mimeType: "text/markdown", sizeBytes: 10, bytes: new Uint8Array([1]) })?.id
    ).toBe("markdown");
    expect(registry.resolve({ filename: "brief.md", mimeType: "application/octet-stream", sizeBytes: 10, bytes: new Uint8Array([1]) })?.id).toBe(
      "markdown"
    );
    expect(registry.resolve({ filename: "brief.bin", mimeType: "application/octet-stream", sizeBytes: 10, bytes: new Uint8Array([1]) })).toBeUndefined();
  });

  it("rejects duplicate processors", () => {
    const registry = new ProcessorRegistry();
    registry.register(new StubProcessor("text", ["text/plain"], ["txt"]));
    expect(() => registry.register(new StubProcessor("text", ["text/plain"], ["txt"]))).toThrow(/already registered/i);
  });
});

describe("knowledge engine upload validation", () => {
  it("accepts a supported markdown file", () => {
    const bytes = new TextEncoder().encode("# PostMotive\nKnowledge");
    const result = validateUploadFile({
      filename: "brief.md",
      mimeType: "text/markdown",
      sizeBytes: bytes.byteLength,
      bytes,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects empty, oversized, traversal, unsupported, and MIME-mismatched uploads", () => {
    expect(
      validateUploadFile({ filename: "empty.md", mimeType: "text/markdown", sizeBytes: 0, bytes: new Uint8Array() })
    ).toMatchObject({ ok: false, code: "INVALID_FILE_METADATA" });

    expect(
      validateUploadFile({
        filename: "huge.md",
        mimeType: "text/markdown",
        sizeBytes: KNOWLEDGE_ENGINE_CONFIG.maxFileSizeBytes + 1,
        bytes: new Uint8Array([65]),
      })
    ).toMatchObject({ ok: false, code: "INVALID_FILE_METADATA" });

    expect(
      validateUploadFile({ filename: "../secret.md", mimeType: "text/markdown", sizeBytes: 4, bytes: new Uint8Array([65, 66, 67, 68]) })
    ).toMatchObject({ ok: false, code: "INVALID_FILENAME" });

    expect(
      validateUploadFile({ filename: "archive.zip", mimeType: "application/zip", sizeBytes: 4, bytes: new Uint8Array([80, 75, 3, 4]) })
    ).toMatchObject({ ok: false, code: "BLOCKED_EXTENSION" });

    expect(
      validateUploadFile({ filename: "image.png", mimeType: "image/png", sizeBytes: 4, bytes: new Uint8Array([65, 66, 67, 68]) })
    ).toMatchObject({ ok: false, code: "MIME_SIGNATURE_MISMATCH" });
  });
});

describe("knowledge engine normalization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes whitespace and preserves headings and locators deterministically", () => {
    const service = new DocumentNormalizationService();
    const normalized = service.normalize(
      createExtractionResult({
        fullText: "Heading\r\n\r\nBody\n\n\nMore",
        sections: [
          {
            id: "section-1",
            heading: " Heading\r\n",
            text: "Body\r\n\r\nMore\t\t\n",
            order: 0,
            pageNumber: 2,
            sheetName: "Sheet1",
          },
        ],
      })
    );

    expect(normalized.completeText).toBe("Heading\n\nBody\n\nMore");
    expect(normalized.sections[0].heading).toBe("Heading");
    expect(normalized.sections[0].pageNumber).toBe(2);
    expect(normalized.sections[0].sheetName).toBe("Sheet1");
    expect(normalized.extractedAt).toBe("2026-07-21T12:00:00.000Z");
  });
});

describe("knowledge engine chunking", () => {
  it("creates deterministic stable chunks with overlap, heading preservation, and no empty chunks", () => {
    const service = new ChunkingService({
      targetChars: 120,
      maxChars: 120,
      overlapChars: 20,
      minChars: 30,
      preserveHeadings: true,
      preferPageBoundaries: true,
    });

    const normalized = createNormalizedDocument({
      sections: [
        {
          id: "s1",
          order: 0,
          heading: "Intro",
          text: `${"A".repeat(90)} ${"B".repeat(90)} ${"C".repeat(30)}`,
          pageNumber: 4,
        },
      ],
    });

    const first = service.chunkDocument({ documentChecksum: "abc123", normalized });
    const second = service.chunkDocument({ documentChecksum: "abc123", normalized });

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
    expect(first.every((chunk) => chunk.text.trim().length > 0)).toBe(true);
    expect(first[0].heading).toBe("Intro");
    expect(first[0].pageNumber).toBe(4);
    expect(first[0].stableKey.startsWith("ck_")).toBe(true);
    expect(first[1].text.startsWith(first[0].text.slice(-20))).toBe(true);
    expect(Math.max(...first.map((chunk) => chunk.text.length))).toBeLessThanOrEqual(141);
  });
});

describe("knowledge engine citations", () => {
  it("creates deterministic bounded citations with clamped confidence and locators", () => {
    const service = new CitationService();
    const chunks = [
      {
        chunkIndex: 0,
        stableKey: "ck_123",
        text: "X".repeat(KNOWLEDGE_ENGINE_CONFIG.maxCitationExcerptLength + 20),
        tokenCount: 20,
        heading: "Evidence",
        pageNumber: 3,
        confidence: 4,
        metadata: { sectionId: "sec-1" },
        embeddingStatus: "NOT_STARTED" as const,
      },
    ];

    const first = service.createCitations({ documentId: "doc_1", collectionId: "col_1", chunks });
    const second = service.createCitations({ documentId: "doc_1", collectionId: "col_1", chunks });
    const references = service.toEvidenceReferences({ documentId: "doc_1", chunkIdByStableKey: { ck_123: "chunk_1" }, citations: first });

    expect(first).toEqual(second);
    expect(first[0].citationKey).toMatch(/^pm:doc_1:0:/);
    expect(first[0].sourceText.length).toBeLessThanOrEqual(KNOWLEDGE_ENGINE_CONFIG.maxCitationExcerptLength);
    expect(first[0].confidence).toBe(1);
    expect(references[0]).toMatchObject({
      chunkId: "chunk_1",
      locator: { pageNumber: 3, section: "sec-1" },
      confidence: 1,
    });
  });
});

describe("knowledge engine storage", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "knowledge-engine-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("saves, reads, checks existence, deletes, and blocks traversal", async () => {
    const storage = new LocalKnowledgeFileStorage(tempDir);
    const bytes = new Uint8Array([65, 66, 67]);
    const saved = await storage.save({
      workspaceId: "ws_1",
      documentId: "doc_1",
      filename: "brief.txt",
      bytes,
      mimeType: "text/plain",
    });

    await expect(storage.exists(saved.storageKey)).resolves.toBe(true);
    await expect(storage.read(saved.storageKey)).resolves.toEqual(Buffer.from(bytes));
    await storage.delete(saved.storageKey);
    await expect(storage.exists(saved.storageKey)).resolves.toBe(false);
    await expect(storage.read("../escape.txt")).rejects.toThrow(/unsafe/i);
  });
});

describe("knowledge engine search", () => {
  it("ranks deterministically and bounds snippets", () => {
    const search = new KnowledgeSearchService();
    const result = search.rank(
      {
        term: "launch",
        page: 1,
        pageSize: 10,
        filters: { workspaceId: "ws_1" },
      },
      [
        {
          documentId: "d1",
          chunkId: "c1",
          chunkStableKey: "k1",
          title: "Launch Playbook",
          filename: "playbook.md",
          mimeType: "text/markdown",
          collectionName: "Go To Market",
          text: "launch launch launch and more context",
          citationKeys: ["ct1"],
          createdAt: "2026-07-20T00:00:00.000Z",
        },
        {
          documentId: "d2",
          chunkId: "c2",
          chunkStableKey: "k2",
          title: "Overview",
          filename: "notes.md",
          mimeType: "text/markdown",
          collectionName: "General",
          text: "launch",
          citationKeys: ["ct2"],
          createdAt: "2026-07-20T00:00:00.000Z",
        },
      ]
    );

    expect(result.total).toBe(2);
    expect(result.items[0].documentId).toBe("d1");
    expect(result.items[0].score).toBeGreaterThan(result.items[1].score);
    expect(result.items[0].snippet.length).toBeLessThanOrEqual(KNOWLEDGE_ENGINE_CONFIG.maxSnippetLength);
  });

  it("passes workspace and filter constraints into query orchestration", async () => {
    const service = new KnowledgeQueryService() as unknown as { repository: { searchCandidates: ReturnType<typeof vi.fn> }; search: KnowledgeSearchService; searchDocuments: KnowledgeQueryService["searchDocuments"] };
    const searchCandidates = vi.fn().mockResolvedValue([
      {
        documentId: "d1",
        chunkId: "c1",
        chunkStableKey: "k1",
        title: "Doc",
        filename: "doc.txt",
        mimeType: "text/plain",
        collectionName: null,
        text: "launch plan",
        sourceType: "UPLOAD",
        status: "READY",
        uploadedById: "user_1",
        citationKeys: [],
        createdAt: "2026-07-21T00:00:00.000Z",
      },
    ]);
    service.repository = { searchCandidates };

    const result = await service.searchDocuments({
      term: "launch",
      page: 1,
      pageSize: 20,
      filters: {
        workspaceId: "ws_1",
        collectionId: "col_1",
        sourceType: "UPLOAD",
        mimeType: "text/plain",
        status: "READY",
        uploadedById: "user_1",
        createdFrom: "2026-07-20T00:00:00.000Z",
        createdTo: "2026-07-22T00:00:00.000Z",
      },
    });

    expect(searchCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_1",
        collectionId: "col_1",
        sourceType: "UPLOAD",
        mimeType: "text/plain",
        status: "READY",
        uploadedById: "user_1",
      })
    );
    expect(result.total).toBe(1);
  });
});

describe("knowledge engine ingestion pipeline", () => {
  function createRepositoryMock() {
    return {
      findDocumentByChecksum: vi.fn().mockResolvedValue(null),
      createQueuedDocument: vi.fn().mockResolvedValue({ id: "doc_1" }),
      createQueuedJob: vi.fn().mockResolvedValue({ id: "job_1" }),
      updateDocumentStorageKey: vi.fn().mockResolvedValue({ id: "doc_1", storageKey: "ws/doc/file.txt" }),
      markDocumentProcessing: vi.fn().mockResolvedValue({ id: "doc_1" }),
      transitionJob: vi.fn().mockResolvedValue({ id: "job_1" }),
      replaceDocumentChunks: vi.fn().mockResolvedValue(undefined),
      replaceDocumentCitations: vi.fn().mockResolvedValue(undefined),
      markDocumentReady: vi.fn().mockResolvedValue({ id: "doc_1", status: "READY" }),
      markDocumentFailed: vi.fn().mockResolvedValue({ id: "doc_1", status: "FAILED" }),
      findDocumentById: vi.fn().mockResolvedValue({
        id: "doc_1",
        collectionId: null,
        originalFilename: "notes.txt",
        mimeType: "text/plain",
        checksum: "abc123",
        storageKey: "ws/doc/file.txt",
      }),
    };
  }

  it("processes a plain-text upload successfully", async () => {
    const service = new KnowledgeIngestionService() as any;
    const repository = createRepositoryMock();
    const processor = { extract: vi.fn().mockResolvedValue(createExtractionResult()) };
    const normalized = createNormalizedDocument();
    const chunks = [
      {
        chunkIndex: 0,
        stableKey: "ck_123",
        text: "launch plan",
        tokenCount: 2,
        heading: "Heading",
        pageNumber: 1,
        confidence: 1,
        metadata: { sectionId: "sec-1" },
        embeddingStatus: "NOT_STARTED",
      },
    ];
    const citations = [
      {
        citationKey: "pm:doc_1:0:abcd1234",
        chunkStableKey: "ck_123",
        chunkIndex: 0,
        pageNumber: 1,
        section: "sec-1",
        sourceText: "launch plan",
        confidence: 1,
      },
    ];

    service.repository = repository;
    service.processorRegistry = { resolve: vi.fn().mockReturnValue(processor) };
    service.connectorRegistry = { getById: vi.fn().mockReturnValue({ id: "upload" }) };
    service.normalization = { normalize: vi.fn().mockReturnValue(normalized) };
    service.chunking = { chunkDocument: vi.fn().mockReturnValue(chunks) };
    service.citation = { createCitations: vi.fn().mockReturnValue(citations) };
    service.storage = {
      save: vi.fn().mockResolvedValue({ storageKey: "ws/doc/file.txt", sizeBytes: 12, mimeType: "text/plain" }),
      read: vi.fn().mockResolvedValue(Buffer.from("launch plan")),
    };

    const result = await service.ingestUpload({
      workspaceId: "ws_1",
      uploadedById: "user_1",
      filename: "notes.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("launch plan"),
    });

    expect(repository.updateDocumentStorageKey).toHaveBeenCalledWith("ws_1", "doc_1", "ws/doc/file.txt");
    expect(repository.markDocumentReady).toHaveBeenCalled();
    expect(result.chunks).toEqual(chunks);
    expect(result.citations).toEqual(citations);
  });

  it("marks the document failed when no processor is available", async () => {
    const service = new KnowledgeIngestionService() as any;
    const repository = createRepositoryMock();

    service.repository = repository;
    service.processorRegistry = { resolve: vi.fn().mockReturnValue(undefined) };
    service.connectorRegistry = { getById: vi.fn().mockReturnValue({ id: "upload" }) };
    service.storage = {
      save: vi.fn().mockResolvedValue({ storageKey: "ws/doc/file.txt", sizeBytes: 12, mimeType: "text/plain" }),
      read: vi.fn().mockResolvedValue(Buffer.from("launch plan")),
    };

    await expect(
      service.ingestUpload({
        workspaceId: "ws_1",
        uploadedById: "user_1",
        filename: "notes.txt",
        mimeType: "text/plain",
        bytes: new TextEncoder().encode("launch plan"),
      })
    ).rejects.toThrow(/INGESTION_FAILED/);

    expect(repository.markDocumentFailed).toHaveBeenCalled();
    expect(repository.transitionJob).toHaveBeenLastCalledWith(
      "ws_1",
      expect.objectContaining({ status: "FAILED", stage: "FAILED" })
    );
  });

  it("marks the document failed when the processor throws", async () => {
    const service = new KnowledgeIngestionService() as any;
    const repository = createRepositoryMock();

    service.repository = repository;
    service.processorRegistry = { resolve: vi.fn().mockReturnValue({ extract: vi.fn().mockRejectedValue(new Error("boom")) }) };
    service.connectorRegistry = { getById: vi.fn().mockReturnValue({ id: "upload" }) };
    service.storage = {
      save: vi.fn().mockResolvedValue({ storageKey: "ws/doc/file.txt", sizeBytes: 12, mimeType: "text/plain" }),
      read: vi.fn().mockResolvedValue(Buffer.from("launch plan")),
    };

    await expect(
      service.ingestUpload({
        workspaceId: "ws_1",
        uploadedById: "user_1",
        filename: "notes.txt",
        mimeType: "text/plain",
        bytes: new TextEncoder().encode("launch plan"),
      })
    ).rejects.toThrow(/INGESTION_FAILED/);

    expect(repository.markDocumentFailed).toHaveBeenCalled();
    expect(repository.transitionJob).toHaveBeenLastCalledWith(
      "ws_1",
      expect.objectContaining({ status: "FAILED", stage: "FAILED" })
    );
  });
});
