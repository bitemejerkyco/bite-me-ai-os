import type { ExtractionResult } from "@/features/knowledge-engine/types";

export type ProcessorInput = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  metadata?: Record<string, unknown>;
};

export interface DocumentProcessor {
  readonly id: string;
  readonly version: string;
  readonly supportedMimeTypes: readonly string[];
  readonly supportedExtensions: readonly string[];

  supports(input: ProcessorInput): boolean;
  extract(input: ProcessorInput): Promise<ExtractionResult>;
}
