import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { AmazonAdsTokenRecord, AmazonAdsTokenStore } from "@/features/marketing/providers/amazon-ads/live/types";

class InMemoryAmazonAdsTokenStore implements AmazonAdsTokenStore {
  readonly kind = "memory" as const;
  private readonly records = new Map<string, AmazonAdsTokenRecord>();

  async get(workspaceId: string, connectionId: string): Promise<AmazonAdsTokenRecord | null> {
    return this.records.get(`${workspaceId}:${connectionId}`) ?? null;
  }

  async save(record: AmazonAdsTokenRecord): Promise<AmazonAdsTokenRecord> {
    this.records.set(`${record.workspaceId}:${record.connectionId}`, record);
    return record;
  }

  async delete(workspaceId: string, connectionId: string): Promise<void> {
    this.records.delete(`${workspaceId}:${connectionId}`);
  }
}

type TokenStoreFileSchema = {
  records: AmazonAdsTokenRecord[];
};

class FileAmazonAdsTokenStore implements AmazonAdsTokenStore {
  readonly kind = "persistent" as const;

  constructor(private readonly filePath: string) {}

  private async readAll(): Promise<TokenStoreFileSchema> {
    try {
      const json = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(json) as TokenStoreFileSchema;
      return { records: Array.isArray(parsed.records) ? parsed.records : [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("ENOENT")) return { records: [] };
      throw error;
    }
  }

  private async writeAll(schema: TokenStoreFileSchema): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(schema, null, 2), "utf8");
  }

  async get(workspaceId: string, connectionId: string): Promise<AmazonAdsTokenRecord | null> {
    const schema = await this.readAll();
    return schema.records.find((row) => row.workspaceId === workspaceId && row.connectionId === connectionId) ?? null;
  }

  async save(record: AmazonAdsTokenRecord): Promise<AmazonAdsTokenRecord> {
    const schema = await this.readAll();
    const index = schema.records.findIndex(
      (row) => row.workspaceId === record.workspaceId && row.connectionId === record.connectionId,
    );
    if (index >= 0) {
      schema.records[index] = record;
    } else {
      schema.records.push(record);
    }
    await this.writeAll(schema);
    return record;
  }

  async delete(workspaceId: string, connectionId: string): Promise<void> {
    const schema = await this.readAll();
    const next = schema.records.filter(
      (row) => !(row.workspaceId === workspaceId && row.connectionId === connectionId),
    );
    if (next.length === schema.records.length) return;
    await this.writeAll({ records: next });
  }
}

let runtimeTokenStore: AmazonAdsTokenStore | null = null;

export function createAmazonAdsTokenStoreForRuntime(filePath = ".data/amazon-ads-token-store.json"): AmazonAdsTokenStore {
  return new FileAmazonAdsTokenStore(filePath);
}

export function createAmazonAdsTokenStoreForTests(): AmazonAdsTokenStore {
  return new InMemoryAmazonAdsTokenStore();
}

export function getAmazonAdsTokenStore(): AmazonAdsTokenStore {
  runtimeTokenStore ||= createAmazonAdsTokenStoreForRuntime();
  return runtimeTokenStore;
}

export function setAmazonAdsTokenStore(store: AmazonAdsTokenStore | null): void {
  runtimeTokenStore = store;
}

export function newTokenRecord(input: {
  workspaceId: string;
  connectionId: string;
  encryptedRefreshToken: string;
  now?: string;
}): AmazonAdsTokenRecord {
  const now = input.now ?? new Date().toISOString();
  return {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    providerId: "amazon-ads-live",
    encryptedRefreshToken: input.encryptedRefreshToken,
    createdAt: now,
    updatedAt: now,
  };
}
