import crypto from "node:crypto";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import type { DocumentChunk, NormalizedDocument, NormalizedSection } from "@/features/knowledge-engine/types";

export type ChunkingConfig = {
  targetChars: number;
  maxChars: number;
  overlapChars: number;
  minChars: number;
  preserveHeadings: boolean;
  preferPageBoundaries: boolean;
};

function estimateTokenCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words * 1.3));
}

function splitByPreferredBoundaries(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf("\n\n", maxChars);
    if (cut < Math.floor(maxChars * 0.5)) cut = remaining.lastIndexOf(". ", maxChars);
    if (cut < Math.floor(maxChars * 0.5)) cut = remaining.lastIndexOf(" ", maxChars);
    if (cut < 1) cut = maxChars;
    const section = remaining.slice(0, cut).trim();
    parts.push(section);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts.filter(Boolean);
}

function buildStableKey(checksum: string, sectionRef: string, chunkIndex: number, chunkText: string): string {
  const normalized = chunkText.trim().replace(/\s+/g, " ");
  const hash = crypto.createHash("sha256").update(`${checksum}|${sectionRef}|${chunkIndex}|${normalized}`).digest("hex").slice(0, 16);
  return `ck_${hash}`;
}

export class ChunkingService {
  constructor(private readonly config: ChunkingConfig = KNOWLEDGE_ENGINE_CONFIG.chunking) {}

  chunkDocument(input: {
    documentChecksum: string;
    normalized: NormalizedDocument;
  }): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sections = input.normalized.sections.length
      ? input.normalized.sections
      : [{ id: "fallback", order: 0, text: input.normalized.completeText } as NormalizedSection];

    let chunkIndex = 0;
    for (const section of sections) {
      const parts = splitByPreferredBoundaries(section.text, this.config.maxChars);
      for (const part of parts) {
        if (part.length < this.config.minChars && chunks.length) {
          const previous = chunks[chunks.length - 1];
          previous.text = `${previous.text}\n${part}`.trim();
          previous.tokenCount = estimateTokenCount(previous.text);
          continue;
        }

        const overlap = chunks.length
          ? chunks[chunks.length - 1].text.slice(Math.max(0, chunks[chunks.length - 1].text.length - this.config.overlapChars))
          : "";
        const textWithOverlap = overlap ? `${overlap}\n${part}` : part;
        const stableKey = buildStableKey(input.documentChecksum, section.id, chunkIndex, textWithOverlap);
        chunks.push({
          chunkIndex,
          stableKey,
          text: textWithOverlap,
          tokenCount: estimateTokenCount(textWithOverlap),
          heading: this.config.preserveHeadings ? section.heading : undefined,
          pageNumber: section.pageNumber,
          confidence: 1,
          metadata: {
            sectionId: section.id,
            sectionOrder: section.order,
            slideNumber: section.slideNumber,
            sheetName: section.sheetName,
            rowNumber: section.rowNumber,
          },
          embeddingStatus: "NOT_STARTED",
        });
        chunkIndex += 1;
      }
    }

    return chunks.filter((chunk) => chunk.text.trim().length > 0);
  }
}
