import crypto from "node:crypto";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import type { CitationRecord, DocumentChunk, EvidenceReference } from "@/features/knowledge-engine/types";

function boundedExcerpt(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= KNOWLEDGE_ENGINE_CONFIG.maxCitationExcerptLength) return cleaned;
  return `${cleaned.slice(0, KNOWLEDGE_ENGINE_CONFIG.maxCitationExcerptLength - 1)}…`;
}

export class CitationService {
  createCitations(params: {
    documentId: string;
    collectionId?: string | null;
    chunks: DocumentChunk[];
  }): CitationRecord[] {
    return params.chunks.map((chunk) => {
      const shortHash = crypto
        .createHash("sha1")
        .update(`${params.documentId}|${chunk.chunkIndex}|${chunk.stableKey}|${chunk.text.slice(0, 120)}`)
        .digest("hex")
        .slice(0, 8);

      return {
        citationKey: `pm:${params.documentId}:${chunk.chunkIndex}:${shortHash}`,
        chunkStableKey: chunk.stableKey,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        section: typeof chunk.metadata?.sectionId === "string" ? chunk.metadata.sectionId : chunk.heading,
        sourceText: boundedExcerpt(chunk.text),
        confidence: Math.min(1, Math.max(0, chunk.confidence)),
        collectionId: params.collectionId,
      };
    });
  }

  toEvidenceReferences(params: { documentId: string; chunkIdByStableKey: Record<string, string>; citations: CitationRecord[] }): EvidenceReference[] {
    const references: EvidenceReference[] = [];

    for (const citation of params.citations) {
      const chunkId = params.chunkIdByStableKey[citation.chunkStableKey];
      if (!chunkId) continue;

      references.push({
        citationKey: citation.citationKey,
        chunkId,
        documentId: params.documentId,
        excerpt: citation.sourceText,
        locator: {
          pageNumber: citation.pageNumber,
          section: citation.section,
        },
        confidence: citation.confidence,
      });
    }

    return references;
  }
}
