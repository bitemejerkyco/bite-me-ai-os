import path from "node:path";
import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";

export class ProcessorRegistry {
  private readonly processors = new Map<string, DocumentProcessor>();

  register(processor: DocumentProcessor): void {
    if (this.processors.has(processor.id)) {
      throw new Error(`Processor with id '${processor.id}' is already registered.`);
    }
    this.processors.set(processor.id, processor);
  }

  list(): DocumentProcessor[] {
    return Array.from(this.processors.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  resolve(input: ProcessorInput): DocumentProcessor | undefined {
    const extension = path.extname(input.filename).replace(/^\./, "").toLowerCase();
    const byMime = this.list().find((processor) => processor.supportedMimeTypes.includes(input.mimeType));
    if (byMime && byMime.supports(input)) return byMime;

    const byExtension = this.list().find((processor) => processor.supportedExtensions.includes(extension));
    if (byExtension && byExtension.supports(input)) return byExtension;

    return undefined;
  }
}
