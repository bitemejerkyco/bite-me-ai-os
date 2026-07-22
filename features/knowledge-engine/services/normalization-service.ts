import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import type { ExtractionResult, NormalizedDocument, NormalizedSection } from "@/features/knowledge-engine/types";

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class DocumentNormalizationService {
  normalize(input: ExtractionResult): NormalizedDocument {
    const sections: NormalizedSection[] = input.sections.map((section) => ({
      ...section,
      text: normalizeWhitespace(section.text),
      heading: section.heading ? normalizeWhitespace(section.heading) : undefined,
    }));

    const completeText = normalizeWhitespace(input.fullText).slice(0, KNOWLEDGE_ENGINE_CONFIG.maxExtractedCharacters);

    return {
      title: input.title,
      author: input.author,
      company: input.company,
      language: input.language,
      completeText,
      sections,
      metadata: input.metadata || {},
      warnings: input.warnings,
      sourceFilename: input.filename,
      mimeType: input.mimeType,
      extractedAt: new Date().toISOString(),
      processorId: input.processorId,
      processorVersion: input.processorVersion,
    };
  }
}
