import { describe, expect, it } from "vitest";
import { validateUploadFile } from "@/features/knowledge-engine/upload/validation";
import { ChunkingService } from "@/features/knowledge-engine/services/chunking-service";
import { KnowledgeSearchService } from "@/features/knowledge-engine/search/search-service";

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

  it("rejects blocked executable extension", () => {
    const bytes = new TextEncoder().encode("echo hi");
    const result = validateUploadFile({
      filename: "run.cmd",
      mimeType: "text/plain",
      sizeBytes: bytes.byteLength,
      bytes,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("BLOCKED_EXTENSION");
    }
  });
});

describe("knowledge engine chunking", () => {
  it("creates stable chunks with overlap metadata", () => {
    const service = new ChunkingService({
      targetChars: 120,
      maxChars: 120,
      overlapChars: 20,
      minChars: 40,
      preserveHeadings: true,
      preferPageBoundaries: true,
    });

    const chunks = service.chunkDocument({
      documentChecksum: "abc123",
      normalized: {
        title: "Doc",
        completeText: "",
        metadata: {},
        warnings: [],
        sourceFilename: "doc.md",
        mimeType: "text/markdown",
        extractedAt: new Date().toISOString(),
        processorId: "markdown",
        processorVersion: "1.0.0",
        sections: [
          {
            id: "s1",
            order: 0,
            heading: "Intro",
            text: "A".repeat(180),
            pageNumber: 1,
          },
        ],
      },
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].stableKey.startsWith("ck_")).toBe(true);
    expect(chunks[0].metadata?.sectionId).toBe("s1");
  });
});

describe("knowledge engine search ranking", () => {
  it("orders candidates by lexical score", () => {
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
          text: "launch launch launch",
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
  });
});
