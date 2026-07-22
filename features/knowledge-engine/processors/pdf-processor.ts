import { PDFParse } from "pdf-parse";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";
import { makeSection, normalizeText, warning } from "@/features/knowledge-engine/processors/helpers";

export class PdfProcessor implements DocumentProcessor {
  readonly id = "pdf";
  readonly version = "1.0.0";
  readonly supportedMimeTypes = ["application/pdf"] as const;
  readonly supportedExtensions = ["pdf"] as const;

  supports(input: ProcessorInput): boolean {
    return input.mimeType === "application/pdf" || input.filename.toLowerCase().endsWith(".pdf");
  }

  async extract(input: ProcessorInput) {
    const warnings: ReturnType<typeof warning>[] = [];
    const pageTexts: string[] = [];
    const pages: { pageNumber: number; text: string; sections: ReturnType<typeof makeSection>[] }[] = [];
    const sections: ReturnType<typeof makeSection>[] = [];

    const parser = new PDFParse({ data: Buffer.from(input.bytes) });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo().catch(() => undefined);
    await parser.destroy();

    const limitedPages = textResult.pages.slice(0, KNOWLEDGE_ENGINE_CONFIG.pdf.maxPages);
    if (textResult.pages.length > limitedPages.length) {
      warnings.push(warning("PDF_PAGE_LIMIT", `Only first ${limitedPages.length} pages were processed.`));
    }

    const normalized = normalizeText(textResult.text || "");
    if (!normalized.trim() && limitedPages.length === 0) {
      warnings.push(warning("PDF_NO_EXTRACTABLE_TEXT", "PDF contains no extractable text; OCR is not implemented in this sprint."));
    }

    limitedPages.forEach((page, idx) => {
      const text = normalizeText(page.text).trim();
      if (!text) {
        warnings.push(warning("PDF_EMPTY_PAGE", `Page ${idx + 1} has no extractable text.`, { pageNumber: idx + 1 }));
        return;
      }
      const section = makeSection({ order: idx, text, pageNumber: idx + 1 });
      sections.push(section);
      pages.push({ pageNumber: idx + 1, text, sections: [section] });
      pageTexts.push(text);
    });

    if (!sections.length && normalized.trim()) {
      const fallback = makeSection({ order: 0, text: normalized, pageNumber: 1 });
      sections.push(fallback);
      pages.push({ pageNumber: 1, text: normalized, sections: [fallback] });
      pageTexts.push(normalized);
    }

    return {
      processorId: this.id,
      processorVersion: this.version,
      mimeType: input.mimeType,
      filename: input.filename,
      fullText: pageTexts.join("\n"),
      pages,
      sections,
      warnings,
      metadata: { pageCount: pages.length, producer: infoResult?.info?.Producer },
      title: infoResult?.info?.Title,
      author: infoResult?.info?.Author,
    };
  }
}
