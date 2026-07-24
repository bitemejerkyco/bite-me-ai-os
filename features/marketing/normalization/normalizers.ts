import { createHash } from "node:crypto";
import type {
  AnyMarketingEntity,
  MarketingEntity,
  MarketingEntityType,
  MarketingQuality,
  MarketingStatus,
} from "@/features/marketing/domain/models";
import type { MarketingNormalizationContext } from "@/features/marketing/types/contexts";

export type MarketingNormalizationInput<
  TData extends Record<string, unknown> = Record<string, unknown>,
> = {
  externalId: string;
  status?: MarketingStatus;
  campaignId?: string | null;
  currency?: string | null;
  quality?: MarketingQuality;
  evidenceId?: string | null;
  occurredAt?: string;
  data: TData;
  providerMetadata?: Record<string, unknown>;
};

export class MarketingNormalizer {
  normalize<TType extends MarketingEntityType, TData extends Record<string, unknown>>(
    entityType: TType,
    input: MarketingNormalizationInput<TData>,
    context: MarketingNormalizationContext,
  ): MarketingEntity<TType, TData> {
    if (!input.externalId.trim()) {
      throw new Error("MARKETING_NORMALIZATION_FAILED:externalId is required.");
    }

    const now = input.occurredAt || context.requestedAt;
    const id = createHash("sha256")
      .update(`${context.workspaceId}:${entityType}:${context.providerId}:${input.externalId}`)
      .digest("hex");

    return {
      id,
      entityType,
      workspaceId: context.workspaceId,
      connectorId: context.connectorId,
      providerId: context.providerId,
      channel: context.channel,
      platform: context.platform,
      campaignId: input.campaignId || null,
      externalId: input.externalId,
      status: input.status || "UNKNOWN",
      currency: input.currency || context.currency || null,
      timezone: context.timezone,
      createdAt: now,
      updatedAt: now,
      sourceMode: context.sourceMode,
      quality: input.quality || "COMPLETE",
      correlationId: context.correlationId,
      evidenceId: input.evidenceId || null,
      ruleVersion: context.ruleVersion,
      data: sanitize(input.data) as TData,
      providerMetadata: {
        providerRecordType: entityType,
        attributes: sanitize(input.providerMetadata || {}) as Record<string, unknown>,
      },
    };
  }
}

export function assertCanonicalMarketingEntity(value: AnyMarketingEntity): void {
  if (!value.workspaceId || !value.providerId || !value.externalId || !value.correlationId) {
    throw new Error("MARKETING_NORMALIZATION_FAILED:Canonical identity fields are required.");
  }
  if ("raw" in value || "rawPayload" in value || "providerPayload" in value) {
    throw new Error("MARKETING_NORMALIZATION_FAILED:Raw provider payloads cannot enter canonical entities.");
  }
}

function sanitize(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((value) => sanitize(value));
  if (!input || typeof input !== "object") return input;
  const source = input as Record<string, unknown>;
  const target: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (/(token|secret|password|authorization)/i.test(key)) {
      target[key] = "[REDACTED]";
      continue;
    }
    target[key] = sanitize(value);
  }
  return target;
}