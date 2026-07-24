import type { AmazonAdsInsightRecord } from "@/features/marketing/providers/amazon-ads/insights/types";

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export type RecommendationType =
  | "high_spend_zero_orders_search_term"
  | "negative_keyword_candidate"
  | "profitable_search_term_keyword_candidate"
  | "high_acos_keyword"
  | "low_impressions_keyword"
  | "budget_limited_campaign"
  | "campaign_wasted_spend"
  | "budget_reallocation"
  | "bid_increase_candidate"
  | "bid_decrease_candidate"
  | "campaign_declining_roas"
  | "strong_campaign_scale_candidate";

export type RecommendationEntityScope = "campaign" | "keyword" | "search-term" | "portfolio";

export type RecommendationReference = {
  scope: RecommendationEntityScope;
  campaignId: string | null;
  campaignName: string;
  keywordId: string | null;
  keyword: string | null;
  searchTerm: string | null;
};

export type RecommendationImpactRange = {
  label: string;
  low: number;
  high: number;
  unit: "USD" | "PERCENT" | "ROAS" | "ORDERS";
};

export type AmazonAdsRecommendation = {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  reference: RecommendationReference;
  marketplaceId: string;
  explanation: string;
  supportingMetrics: Record<string, number | string>;
  calculationEvidence: string;
  confidenceScore: number;
  estimatedImpactRange: RecommendationImpactRange;
  suggestedAction: string;
  status: "Read Only — No changes applied";
};

export type AmazonAdsRecommendationFilters = {
  priority: "ALL" | RecommendationPriority;
  type: "ALL" | RecommendationType;
  campaignId: "ALL" | string;
  marketplaceId: "ALL" | string;
};

export type RecommendationSummary = Record<RecommendationPriority, number>;

export type AmazonAdsRecommendationThresholds = {
  highSpendSearchTermMinSpend: number;
  highSpendSearchTermMinClicks: number;
  negativeKeywordMinSpend: number;
  negativeKeywordMinClicks: number;
  profitableTermMinOrders: number;
  profitableTermMinRoas: number;
  profitableTermMinClicks: number;
  keywordHighAcosThreshold: number;
  keywordHighAcosMinSpend: number;
  keywordLowImpressionsThreshold: number;
  keywordLowImpressionsMinClicks: number;
  budgetLimitedSpendRatioThreshold: number;
  budgetLimitedMinSpend: number;
  campaignWastedSpendMinSpend: number;
  campaignWastedSpendAcosThreshold: number;
  budgetReallocationStrongRoasThreshold: number;
  budgetReallocationWeakRoasThreshold: number;
  budgetReallocationMinStrongSpend: number;
  budgetReallocationMinWeakSpend: number;
  bidIncreaseMinRoas: number;
  bidIncreaseMinOrders: number;
  bidIncreaseMinClicks: number;
  bidDecreaseAcosThreshold: number;
  bidDecreaseMinClicks: number;
  bidDecreaseMinSpend: number;
  decliningRoasMinDailyPoints: number;
  decliningRoasDropPercentThreshold: number;
  scaleCandidateMinRoas: number;
  scaleCandidateMinOrders: number;
  scaleCandidateMinSpend: number;
};

export type RecommendationGenerationResult = {
  generatedAt: string;
  sourceRecords: AmazonAdsInsightRecord[];
  recommendations: AmazonAdsRecommendation[];
  summary: RecommendationSummary;
  filterOptions: {
    priorities: RecommendationPriority[];
    types: RecommendationType[];
    campaigns: Array<{ campaignId: string; campaignName: string }>;
    marketplaces: string[];
  };
};
