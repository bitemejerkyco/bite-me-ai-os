import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";
import { makeSection, normalizeText } from "@/features/knowledge-engine/processors/helpers";

export class MarkdownProcessor implements DocumentProcessor {
  readonly id = "markdown";
  readonly version = "1.0.0";
  readonly supportedMimeTypes = ["text/markdown"] as const;
  readonly supportedExtensions = ["md"] as const;

  supports(input: ProcessorInput): boolean {
    return this.supportedMimeTypes.includes(input.mimeType as "text/markdown") || input.filename.toLowerCase().endsWith(".md");
  }

  async extract(input: ProcessorInput) {
    const text = normalizeText(Buffer.from(input.bytes).toString("utf8"));
    const lines = text.split("\n");
    const sections = [];
    let currentHeading: string | undefined;
    let currentBody: string[] = [];
    let order = 0;

    const flush = () => {
      const sectionText = currentBody.join("\n").trim();
      if (!sectionText) return;
      sections.push(makeSection({ order: order++, heading: currentHeading, text: sectionText, pageNumber: 1 }));
      currentBody = [];
    };

    for (const line of lines) {
      const headingMatch = /^(#{1,6})\s+(.+)/.exec(line.trim());
      if (headingMatch) {
        flush();
        currentHeading = headingMatch[2].trim();
      } else {
        currentBody.push(line);
      }
    }
    flush();

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
      warnings: [],
      metadata: {},
    };
  }
}
