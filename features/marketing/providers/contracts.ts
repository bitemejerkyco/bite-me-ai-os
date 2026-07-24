import type { AnyMarketingEntity } from "@/features/marketing/domain/models";
import type { MarketingNormalizationContext } from "@/features/marketing/types/contexts";

export type ProviderNormalizationRequest = {
  records: ReadonlyArray<Record<string, unknown>>;
  context: MarketingNormalizationContext;
};

export type MarketingProviderCertification = {
  requiredEndpoints: readonly string[];
  optionalEndpoints: readonly string[];
  incrementalSyncSupport: "REQUIRED" | "OPTIONAL" | "NOT_EXPECTED";
  historicalSyncSupport: "REQUIRED" | "OPTIONAL" | "NOT_EXPECTED";
  realTimeCapability: "WEBHOOK" | "POLLING" | "BOTH" | "NONE" | "UNKNOWN";
  rateLimitBehavior: "PROVIDER_HEADERS_AND_BACKOFF" | "FIXED_WINDOW" | "UNKNOWN";
  retryStrategy: "EXPONENTIAL_BACKOFF_WITH_JITTER";
  checkpointSupport: boolean;
  healthChecks: readonly string[];
  paginationModel: "CURSOR" | "PAGE" | "TOKEN" | "MIXED" | "UNKNOWN";
  currencyHandling: "SOURCE_CURRENCY_WITH_ISO_4217";
  timezoneHandling: "PROVIDER_TIMEZONE_TO_IANA";
};

export interface MarketingProvider {
  readonly providerId: string;
  readonly version: string;
  readonly certification: MarketingProviderCertification;
  normalizeCampaign(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeCreative(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeAudience(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeSpend(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizePerformance(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeConversion(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeJourney(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeEmail(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeSMS(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeExperiment(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeLandingPage(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeMetrics(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeTimeline(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
  normalizeInsights(input: ProviderNormalizationRequest): Promise<AnyMarketingEntity[]>;
}

export type AmazonAdsProvider = MarketingProvider & { readonly providerId: "amazon-ads" };