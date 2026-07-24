import type { MarketingChannel, MarketingSourceMode } from "@/features/marketing/domain/models";

export type MarketingWorkspaceContext = {
  workspaceId: string;
  workspaceSlug: string;
  timezone: string;
  currency: string;
};

export type MarketingExecutionContext = {
  correlationId: string;
  requestedAt: string;
  sourceMode: MarketingSourceMode;
};

export type MarketingProviderContext = {
  providerId: string;
  connectorId: string | null;
  platform: string;
  channel: MarketingChannel;
};

export type MarketingNormalizationContext = MarketingWorkspaceContext &
  MarketingExecutionContext &
  MarketingProviderContext & {
    ruleVersion: string;
  };