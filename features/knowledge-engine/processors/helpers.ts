import crypto from "node:crypto";
import type { ExtractedSection, ProcessingWarning } from "@/features/knowledge-engine/types";

export function normalizeText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

export function toSectionId(seed: string): string {
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 12);
}

export function makeSection(params: {
  order: number;
  text: string;
  heading?: string;
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  rowNumber?: number;
  metadata?: Record<string, unknown>;
}): ExtractedSection {
  const base = `${params.order}:${params.heading || ""}:${params.pageNumber || 0}:${params.slideNumber || 0}:${params.sheetName || ""}:${params.text.slice(0, 50)}`;
  return {
    id: toSectionId(base),
    order: params.order,
    text: normalizeText(params.text),
    heading: params.heading,
    pageNumber: params.pageNumber,
    slideNumber: params.slideNumber,
    sheetName: params.sheetName,
    rowNumber: params.rowNumber,
    metadata: params.metadata,
  };
}

export function warning(code: string, message: string, locator?: ProcessingWarning["locator"]): ProcessingWarning {
  return { code, message, locator };
}
