import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  AmazonAdsIntegrationActor,
  AmazonAdsStatePayload,
  AmazonAdsStateStore,
} from "@/features/marketing/providers/amazon-ads/live/types";

const DEFAULT_STATE_TTL_MS = 5 * 60 * 1000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

type CreateStateInput = {
  actor: AmazonAdsIntegrationActor;
  connectionId: string;
  now?: Date;
  ttlMs?: number;
};

type ConsumeStateInput = {
  state: string;
  actor: AmazonAdsIntegrationActor;
  now?: Date;
};

type OAuthStateFileSchema = {
  records: AmazonAdsStatePayload[];
};

function assertActor(actor: AmazonAdsIntegrationActor): void {
  if (!SAFE_ID.test(actor.workspaceId) || !SAFE_ID.test(actor.userId)) {
    throw new Error("ACTOR_INVALID:workspaceId and userId must be safe identifiers.");
  }
}

function buildPayload(input: CreateStateInput): AmazonAdsStatePayload {
  assertActor(input.actor);
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_STATE_TTL_MS;
  const state = randomBytes(32).toString("base64url");
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  return {
    state,
    workspaceId: input.actor.workspaceId,
    userId: input.actor.userId,
    connectionId: input.connectionId || randomUUID(),
    createdAt,
    expiresAt,
    consumedAt: null,
  };
}

function validateAndConsume(
  payload: AmazonAdsStatePayload | undefined,
  input: ConsumeStateInput,
): AmazonAdsStatePayload {
  assertActor(input.actor);
  const now = input.now ?? new Date();
  if (!payload) {
    throw new Error("OAUTH_STATE_MISSING:Authorization state was not found.");
  }
  if (payload.consumedAt) {
    throw new Error("OAUTH_STATE_REUSED:Authorization state has already been used.");
  }
  if (new Date(payload.expiresAt).getTime() <= now.getTime()) {
    throw new Error("OAUTH_STATE_EXPIRED:Authorization state has expired.");
  }
  if (payload.workspaceId !== input.actor.workspaceId || payload.userId !== input.actor.userId) {
    throw new Error("OAUTH_STATE_MISMATCH:Authorization state does not match the initiating actor.");
  }
  return { ...payload, consumedAt: now.toISOString() };
}

class InMemoryAmazonAdsOAuthStateStore implements AmazonAdsStateStore {
  readonly kind = "memory" as const;
  private readonly records = new Map<string, AmazonAdsStatePayload>();

  async create(input: CreateStateInput): Promise<AmazonAdsStatePayload> {
    const payload = buildPayload(input);
    this.records.set(payload.state, payload);
    return payload;
  }

  async consume(input: ConsumeStateInput): Promise<AmazonAdsStatePayload> {
    const payload = this.records.get(input.state);
    const consumed = validateAndConsume(payload, input);
    this.records.set(input.state, consumed);
    return consumed;
  }
}

class FileAmazonAdsOAuthStateStore implements AmazonAdsStateStore {
  readonly kind = "file" as const;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let releaseQueue: () => void = () => {};
    this.queue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      releaseQueue();
    }
  }

  private async readAll(): Promise<OAuthStateFileSchema> {
    try {
      const json = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(json) as OAuthStateFileSchema;
      return { records: Array.isArray(parsed.records) ? parsed.records : [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("ENOENT")) return { records: [] };
      throw error;
    }
  }

  private async writeAll(schema: OAuthStateFileSchema): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(schema, null, 2), "utf8");
  }

  async create(input: CreateStateInput): Promise<AmazonAdsStatePayload> {
    return this.withLock(async () => {
      const payload = buildPayload(input);
      const schema = await this.readAll();
      schema.records = schema.records.filter((row) => row.state !== payload.state);
      schema.records.push(payload);
      await this.writeAll(schema);
      return payload;
    });
  }

  async consume(input: ConsumeStateInput): Promise<AmazonAdsStatePayload> {
    return this.withLock(async () => {
      const schema = await this.readAll();
      const index = schema.records.findIndex((row) => row.state === input.state);
      const payload = index >= 0 ? schema.records[index] : undefined;
      const consumed = validateAndConsume(payload, input);
      if (index >= 0) {
        schema.records[index] = consumed;
      }
      await this.writeAll(schema);
      return consumed;
    });
  }
}

let runtimeStateStore: AmazonAdsStateStore | null = null;

export function createAmazonAdsOAuthStateStoreForRuntime(filePath = ".data/amazon-ads-oauth-state-store.json"): AmazonAdsStateStore {
  return new FileAmazonAdsOAuthStateStore(filePath);
}

export function createAmazonAdsOAuthStateStoreForTests(): AmazonAdsStateStore {
  return new InMemoryAmazonAdsOAuthStateStore();
}

export function getAmazonAdsOAuthStateStore(): AmazonAdsStateStore {
  runtimeStateStore ||= createAmazonAdsOAuthStateStoreForRuntime();
  return runtimeStateStore;
}

export function setAmazonAdsOAuthStateStore(store: AmazonAdsStateStore | null): void {
  runtimeStateStore = store;
}
