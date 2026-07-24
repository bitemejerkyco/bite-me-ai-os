import { ProcessorRegistry } from "@/features/knowledge-engine/processors/registry";
import { TextProcessor } from "@/features/knowledge-engine/processors/text-processor";
import { MarkdownProcessor } from "@/features/knowledge-engine/processors/markdown-processor";
import { CsvProcessor } from "@/features/knowledge-engine/processors/csv-processor";
import { PdfProcessor } from "@/features/knowledge-engine/processors/pdf-processor";
import { DocxProcessor } from "@/features/knowledge-engine/processors/docx-processor";
import { PptxProcessor } from "@/features/knowledge-engine/processors/pptx-processor";
import { XlsxProcessor } from "@/features/knowledge-engine/processors/xlsx-processor";
import { ImageMetadataProcessor } from "@/features/knowledge-engine/processors/image-metadata-processor";

export function createDefaultProcessorRegistry() {
  const registry = new ProcessorRegistry();
  registry.register(new TextProcessor());
  registry.register(new MarkdownProcessor());
  registry.register(new CsvProcessor());
  registry.register(new PdfProcessor());
  registry.register(new DocxProcessor());
  registry.register(new PptxProcessor());
  registry.register(new XlsxProcessor());
  registry.register(new ImageMetadataProcessor());
  return registry;
}
