import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import type { KnowledgeFileStorage, SaveKnowledgeFileInput, StoredKnowledgeFile } from "@/features/knowledge-engine/storage/storage";

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function ensureSafeStorageKey(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes("://")) {
    throw new Error("Unsafe storage key.");
  }
  return normalized;
}

export class LocalKnowledgeFileStorage implements KnowledgeFileStorage {
  private readonly rootDir: string;

  constructor(rootDir = KNOWLEDGE_ENGINE_CONFIG.localStorageRoot) {
    this.rootDir = path.resolve(process.cwd(), rootDir);
  }

  private absolutePathForKey(storageKey: string): string {
    const safeKey = ensureSafeStorageKey(storageKey);
    const fullPath = path.resolve(this.rootDir, safeKey);
    if (!fullPath.startsWith(this.rootDir)) {
      throw new Error("Resolved path escapes storage root.");
    }
    return fullPath;
  }

  async save(input: SaveKnowledgeFileInput): Promise<StoredKnowledgeFile> {
    const workspaceId = sanitizeSegment(input.workspaceId);
    const documentId = sanitizeSegment(input.documentId);
    const filename = sanitizeSegment(input.filename);
    const suffix = crypto.createHash("sha1").update(Buffer.from(input.bytes)).digest("hex").slice(0, 10);
    const storageKey = `${workspaceId}/${documentId}/${suffix}-${filename}`;
    const absolutePath = this.absolutePathForKey(storageKey);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, Buffer.from(input.bytes));

    return {
      storageKey,
      sizeBytes: input.bytes.byteLength,
      mimeType: input.mimeType,
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    const absolutePath = this.absolutePathForKey(storageKey);
    return fs.readFile(absolutePath);
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = this.absolutePathForKey(storageKey);
    await fs.rm(absolutePath, { force: true });
  }

  async exists(storageKey: string): Promise<boolean> {
    const absolutePath = this.absolutePathForKey(storageKey);
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }
}
