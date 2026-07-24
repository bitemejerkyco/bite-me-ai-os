import { imageSize } from "image-size";
import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";
import { makeSection, warning } from "@/features/knowledge-engine/processors/helpers";

export class ImageMetadataProcessor implements DocumentProcessor {
  readonly id = "image-metadata";
  readonly version = "1.0.0";
  readonly supportedMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
  readonly supportedExtensions = ["png", "jpg", "jpeg", "webp"] as const;

  supports(input: ProcessorInput): boolean {
    return this.supportedMimeTypes.includes(input.mimeType as (typeof this.supportedMimeTypes)[number]);
  }

  async extract(input: ProcessorInput) {
    const meta = imageSize(Buffer.from(input.bytes));
    const message = `Image metadata extracted (${meta.type || "unknown"}, ${meta.width || "?"}x${meta.height || "?"}). No textual content extracted.`;
    const section = makeSection({ order: 0, text: message, pageNumber: 1 });
    return {
      processorId: this.id,
      processorVersion: this.version,
      mimeType: input.mimeType,
      filename: input.filename,
      fullText: message,
      pages: [{ pageNumber: 1, text: message, sections: [section] }],
      sections: [section],
      warnings: [warning("IMAGE_TEXT_UNAVAILABLE", "OCR is not implemented in Sprint 3A; image metadata only.", { pageNumber: 1 })],
      metadata: {
        width: meta.width,
        height: meta.height,
        type: meta.type,
        orientation: meta.orientation,
      },
    };
  }
}
