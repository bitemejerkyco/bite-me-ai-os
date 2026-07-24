import { randomBytes, randomUUID } from "node:crypto";
import type { AmazonAdsIntegrationActor, AmazonAdsStatePayload } from "@/features/marketing/providers/amazon-ads/live/types";

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

function assertActor(actor: AmazonAdsIntegrationActor): void {
  if (!SAFE_ID.test(actor.workspaceId) || !SAFE_ID.test(actor.userId)) {
    throw new Error("ACTOR_INVALID:workspaceId and userId must be safe identifiers.");
  }
}

export class AmazonAdsOAuthStateStore {
  private readonly records = new Map<string, AmazonAdsStatePayload>();

  create(input: CreateStateInput): AmazonAdsStatePayload {
    assertActor(input.actor);
    const now = input.now ?? new Date();
    const ttlMs = input.ttlMs ?? DEFAULT_STATE_TTL_MS;
    const state = randomBytes(32).toString("base64url");
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    const payload: AmazonAdsStatePayload = {
      state,
      workspaceId: input.actor.workspaceId,
      userId: input.actor.userId,
      connectionId: input.connectionId || randomUUID(),
      createdAt,
      expiresAt,
      consumedAt: null,
    };
    this.records.set(state, payload);
    return payload;
  }

  consume(input: ConsumeStateInput): AmazonAdsStatePayload {
    assertActor(input.actor);
    const now = input.now ?? new Date();
    const payload = this.records.get(input.state);
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
    const consumed: AmazonAdsStatePayload = { ...payload, consumedAt: now.toISOString() };
    this.records.set(input.state, consumed);
    return consumed;
  }
}

let globalStateStore: AmazonAdsOAuthStateStore | null = null;

export function getAmazonAdsOAuthStateStore(): AmazonAdsOAuthStateStore {
  globalStateStore ||= new AmazonAdsOAuthStateStore();
  return globalStateStore;
}

export function setAmazonAdsOAuthStateStore(store: AmazonAdsOAuthStateStore | null): void {
  globalStateStore = store;
}
