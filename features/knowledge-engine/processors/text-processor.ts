import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";
import { makeSection, normalizeText } from "@/features/knowledge-engine/processors/helpers";

export class TextProcessor implements DocumentProcessor {
  readonly id = "text";
  readonly version = "1.0.0";
  readonly supportedMimeTypes = ["text/plain"] as const;
  readonly supportedExtensions = ["txt"] as const;

  supports(input: ProcessorInput): boolean {
    return this.supportedMimeTypes.includes(input.mimeType as "text/plain") || input.filename.toLowerCase().endsWith(".txt");
  }

  async extract(input: ProcessorInput) {
    const text = normalizeText(Buffer.from(input.bytes).toString("utf8"));
    return {
      processorId: this.id,
      processorVersion: this.version,
      mimeType: input.mimeType,
      filename: input.filename,
      fullText: text,
      pages: [{ pageNumber: 1, text, sections: [makeSection({ order: 0, text, pageNumber: 1 })] }],
      sections: [makeSection({ order: 0, text, pageNumber: 1 })],
      warnings: [],
      metadata: {},
    };
  }
}
