import path from "node:path";
import crypto from "node:crypto";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import type { KnowledgeFile, UploadValidationResult } from "@/features/knowledge-engine/types";
import { uploadFileSchema } from "@/features/knowledge-engine/schemas/upload";

function sanitizeFilename(name: string): string {
  const normalized = name
    .normalize("NFKC")
    .replace(/[/\\]/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .trim();
  return normalized.slice(0, KNOWLEDGE_ENGINE_CONFIG.maxUploadFilenameLength) || "file";
}

function hasTraversalSequence(name: string): boolean {
  return name.includes("..") || /[/\\]/.test(name);
}

function extensionFromFilename(name: string): string {
  return path.extname(name).replace(/^\./, "").toLowerCase();
}

function quickSignatureCheck(mimeType: string, bytes: Uint8Array): boolean {
  if (!bytes.length) return false;
  const header = Buffer.from(bytes.slice(0, 8)).toString("hex");
  if (mimeType === "application/pdf") return header.startsWith("25504446");
  if (mimeType === "image/png") return header.startsWith("89504e47");
  if (mimeType === "image/jpeg") return header.startsWith("ffd8ff");
  if (mimeType === "image/webp") return Buffer.from(bytes.slice(0, 4)).toString("ascii") === "RIFF";
  return true;
}

export function computeSha256(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function validateUploadFile(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
}): UploadValidationResult {
  const parsed = uploadFileSchema.safeParse({
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_FILE_METADATA",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }

  if (!input.bytes.length) {
    return { ok: false, code: "EMPTY_FILE", message: "File is empty." };
  }

  if (hasTraversalSequence(input.filename)) {
    return { ok: false, code: "INVALID_FILENAME", message: "Filename contains path traversal or path separators." };
  }

  const normalizedExtension = extensionFromFilename(input.filename);
  if (!normalizedExtension) {
    return { ok: false, code: "MISSING_EXTENSION", message: "File extension is required." };
  }

  if (KNOWLEDGE_ENGINE_CONFIG.blockedExtensions.includes(normalizedExtension as (typeof KNOWLEDGE_ENGINE_CONFIG.blockedExtensions)[number])) {
    return { ok: false, code: "BLOCKED_EXTENSION", message: `Files with .${normalizedExtension} extension are blocked.` };
  }

  if (!KNOWLEDGE_ENGINE_CONFIG.supportedExtensions.includes(normalizedExtension as (typeof KNOWLEDGE_ENGINE_CONFIG.supportedExtensions)[number])) {
    return { ok: false, code: "UNSUPPORTED_EXTENSION", message: `File extension .${normalizedExtension} is not supported.` };
  }

  if (!KNOWLEDGE_ENGINE_CONFIG.supportedMimeTypes.includes(input.mimeType as (typeof KNOWLEDGE_ENGINE_CONFIG.supportedMimeTypes)[number])) {
    return { ok: false, code: "UNSUPPORTED_MIME", message: `MIME type ${input.mimeType} is not supported.` };
  }

  if (!quickSignatureCheck(input.mimeType, input.bytes)) {
    return { ok: false, code: "MIME_SIGNATURE_MISMATCH", message: "File signature does not match the declared MIME type." };
  }

  return {
    ok: true,
    sanitizedFilename: sanitizeFilename(input.filename),
    normalizedExtension,
    mimeType: input.mimeType,
  };
}

export function toKnowledgeFile(file: {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}): KnowledgeFile {
  const sanitized = sanitizeFilename(file.filename);
  const extension = extensionFromFilename(sanitized);
  return {
    filename: sanitized,
    originalFilename: file.filename,
    extension,
    mimeType: file.mimeType,
    bytes: file.bytes,
    sizeBytes: file.bytes.byteLength,
    checksum: computeSha256(file.bytes),
  };
}
