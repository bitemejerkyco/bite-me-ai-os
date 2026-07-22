import JSZip from "jszip";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";
import { makeSection, normalizeText, warning } from "@/features/knowledge-engine/processors/helpers";

function extractTextFromSlideXml(xml: string): string {
  const matches = Array.from(xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/g));
  return normalizeText(matches.map((match) => match[1]).join(" "));
}

export class PptxProcessor implements DocumentProcessor {
  readonly id = "pptx";
  readonly version = "1.0.0";
  readonly supportedMimeTypes = ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] as const;
  readonly supportedExtensions = ["pptx"] as const;

  supports(input: ProcessorInput): boolean {
    return this.supportedMimeTypes.includes(
      input.mimeType as "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) || input.filename.toLowerCase().endsWith(".pptx");
  }

  async extract(input: ProcessorInput) {
    const zip = await JSZip.loadAsync(Buffer.from(input.bytes));
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const aNum = Number(a.match(/slide(\d+)\.xml$/)?.[1] || "0");
        const bNum = Number(b.match(/slide(\d+)\.xml$/)?.[1] || "0");
        return aNum - bNum;
      })
      .slice(0, KNOWLEDGE_ENGINE_CONFIG.presentation.maxSlides);

    const warnings = [];
    const sections = [];
    const pages = [];

    for (let i = 0; i < slideFiles.length; i += 1) {
      const slideNumber = i + 1;
      const xml = await zip.files[slideFiles[i]].async("string");
      const text = extractTextFromSlideXml(xml).trim();
      if (!text) {
        warnings.push(warning("PPTX_EMPTY_SLIDE", `Slide ${slideNumber} has no extractable text.`, { slideNumber }));
        continue;
      }
      const section = makeSection({ order: i, text, slideNumber, metadata: { slideNumber } });
      sections.push(section);
      pages.push({ pageNumber: slideNumber, text, sections: [section] });
    }

    const fullText = sections.map((section) => section.text).join("\n");

    return {
      processorId: this.id,
      processorVersion: this.version,
      mimeType: input.mimeType,
      filename: input.filename,
      fullText,
      pages,
      sections,
      warnings,
      metadata: { slideCount: slideFiles.length },
    };
  }
}
