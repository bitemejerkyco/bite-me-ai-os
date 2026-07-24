export type AmazonAdsRegion = "na" | "eu" | "fe";

export type AmazonAdsSandboxRequest = {
  workspaceId: string;
  connectorId: string;
  profileId: string;
  marketplaceId: string;
  region: AmazonAdsRegion;
  currency: string;
  timezone: string;
  correlationId: string;
  startDate?: string;
  endDate?: string;
  nextToken?: string | null;
  maxResults?: number;
};

export type AmazonAdsPage<T> = {
  results: T[];
  nextToken: string | null;
  requestId: string | null;
  rateLimit: number | null;
  rateLimitRemaining: number | null;
};

export type AmazonAdsReportType =
  | "spCampaigns"
  | "spAdGroups"
  | "spAdvertisedProduct"
  | "spKeywords"
  | "spTargeting"
  | "spSearchTerm";

