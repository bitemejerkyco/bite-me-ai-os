export const MARKETING_ENTITY_TYPES = [
  "CAMPAIGN",
  "CAMPAIGN_GROUP",
  "CREATIVE",
  "AUDIENCE",
  "PERFORMANCE",
  "CONVERSION",
  "EVIDENCE",
] as const;

export type MarketingEntityType = (typeof MARKETING_ENTITY_TYPES)[number];
export type MarketingChannel = "MARKETPLACE" | "OTHER";
export type MarketingSourceMode = "SANDBOX" | "LIVE" | "MOCK";
export type MarketingQuality = "COMPLETE" | "PARTIAL";
export type MarketingStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED"
  | "UNKNOWN";

export type MarketingProviderRecordMetadata = {
  providerRecordType: string;
  providerVersion?: string;
  attributes: Record<string, unknown>;
};

export type MarketingEntityBase = {
  id: string;
  entityType: MarketingEntityType;
  workspaceId: string;
  connectorId: string | null;
  providerId: string;
  channel: MarketingChannel;
  platform: string;
  campaignId: string | null;
  externalId: string;
  status: MarketingStatus;
  currency: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  sourceMode: MarketingSourceMode;
  quality: MarketingQuality;
  correlationId: string;
  evidenceId: string | null;
  ruleVersion: string;
  providerMetadata: MarketingProviderRecordMetadata;
};

export type MarketingEntity<
  TType extends MarketingEntityType,
  TData extends Record<string, unknown> = Record<string, unknown>,
> = MarketingEntityBase & { entityType: TType; data: TData };

export type MarketingCampaign = MarketingEntity<"CAMPAIGN">;
export type MarketingCampaignGroup = MarketingEntity<"CAMPAIGN_GROUP">;
export type MarketingCreative = MarketingEntity<"CREATIVE">;
export type MarketingAudience = MarketingEntity<"AUDIENCE">;
export type MarketingPerformance = MarketingEntity<"PERFORMANCE">;
export type MarketingConversion = MarketingEntity<"CONVERSION">;
export type MarketingEvidence = MarketingEntity<"EVIDENCE">;

export type AnyMarketingEntity =
  | MarketingCampaign
  | MarketingCampaignGroup
  | MarketingCreative
  | MarketingAudience
  | MarketingPerformance
  | MarketingConversion
  | MarketingEvidence;

export type MarketingListQuery = {
  workspaceId: string;
  entityType?: MarketingEntityType;
  connectorId?: string;
  providerId?: string;
  campaignId?: string;
  limit?: number;
};