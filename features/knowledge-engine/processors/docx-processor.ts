import mammoth from "mammoth";
import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";
import { makeSection, normalizeText, warning } from "@/features/knowledge-engine/processors/helpers";

export class DocxProcessor implements DocumentProcessor {
  readonly id = "docx";
  readonly version = "1.0.0";
  readonly supportedMimeTypes = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;
  readonly supportedExtensions = ["docx"] as const;

  supports(input: ProcessorInput): boolean {
    return this.supportedMimeTypes.includes(
      input.mimeType as "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) || input.filename.toLowerCase().endsWith(".docx");
  }

  async extract(input: ProcessorInput) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(input.bytes) });
    const warnings = result.messages.map((message) => warning("DOCX_PARSE_WARNING", message.message));
    const text = normalizeText(result.value);
    const sections = text
      .split(/\n\n+/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block, index) => {
        const heading = /^(?:[A-Z][^\n]{0,120})$/.test(block) ? block : undefined;
        return makeSection({ order: index, heading, text: block, pageNumber: 1 });
      });

    if (!sections.length) {
      sections.push(makeSection({ order: 0, text, pageNumber: 1 }));
    }

    return {
      processorId: this.id,
      processorVersion: this.version,
      mimeType: input.mimeType,
      filename: input.filename,
      fullText: text,
      pages: [{ pageNumber: 1, text, sections }],
      sections,
      warnings,
      metadata: {},
    };
  }
}
