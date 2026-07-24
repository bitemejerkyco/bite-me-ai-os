import type { AnyMarketingEntity } from "@/features/marketing/domain/models";
import type { AmazonAdsProvider, ProviderNormalizationRequest } from "@/features/marketing/providers/contracts";
import { AmazonAdsCanonicalNormalizer } from "@/features/marketing/providers/amazon-ads/normalization/normalizers";

export class AmazonAdsMarketingProvider implements AmazonAdsProvider {
  readonly providerId = "amazon-ads" as const;
  readonly version = "sponsored-products-sandbox-v1";
  readonly certification = {
    requiredEndpoints: [
      "Sponsored Products campaigns (read)", "Sponsored Products ad groups (read)",
      "Sponsored Products product ads (read)", "Sponsored Products keywords and targets (read)",
      "Reporting v3 create/status/download",
    ],
    optionalEndpoints: ["Profiles (read)"],
    incrementalSyncSupport: "REQUIRED", historicalSyncSupport: "REQUIRED",
    realTimeCapability: "POLLING", rateLimitBehavior: "PROVIDER_HEADERS_AND_BACKOFF",
    retryStrategy: "EXPONENTIAL_BACKOFF_WITH_JITTER", checkpointSupport: true,
    healthChecks: ["LWA credential reference", "advertising profile read", "rate-limit and report status"],
    paginationModel: "TOKEN", currencyHandling: "SOURCE_CURRENCY_WITH_ISO_4217",
    timezoneHandling: "PROVIDER_TIMEZONE_TO_IANA",
  } as const;

  constructor(private readonly normalizer = new AmazonAdsCanonicalNormalizer()) {}
  private map(input: ProviderNormalizationRequest, method: "campaign" | "ad" | "targeting" | "performance" | "conversion" | "evidence"): Promise<AnyMarketingEntity[]> {
    if (input.context.sourceMode !== "SANDBOX") throw new Error("SANDBOX_ONLY:Amazon Ads Marketing adapter is not certified for live mode.");
    return Promise.resolve(input.records.map((row) => this.normalizer[method](row, input.context)));
  }
  normalizeCampaign(input: ProviderNormalizationRequest) { return this.map(input, "campaign"); }
  normalizeCreative(input: ProviderNormalizationRequest) { return this.map(input, "ad"); }
  normalizeAudience(input: ProviderNormalizationRequest) { return this.map(input, "targeting"); }
  normalizeSpend(input: ProviderNormalizationRequest) { return this.map(input, "performance"); }
  normalizePerformance(input: ProviderNormalizationRequest) { return this.map(input, "performance"); }
  normalizeConversion(input: ProviderNormalizationRequest) { return this.map(input, "conversion"); }
  normalizeJourney(input: ProviderNormalizationRequest) { return this.map(input, "evidence"); }
  normalizeEmail(input: ProviderNormalizationRequest) { return this.map(input, "evidence"); }
  normalizeSMS(input: ProviderNormalizationRequest) { return this.map(input, "evidence"); }
  normalizeExperiment(input: ProviderNormalizationRequest) { return this.map(input, "evidence"); }
  normalizeLandingPage(input: ProviderNormalizationRequest) { return this.map(input, "evidence"); }
  normalizeMetrics(input: ProviderNormalizationRequest) { return this.map(input, "performance"); }
  normalizeTimeline(input: ProviderNormalizationRequest) { return this.map(input, "evidence"); }
  normalizeInsights(input: ProviderNormalizationRequest) { return this.map(input, "evidence"); }
}

