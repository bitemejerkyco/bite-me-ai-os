import {
  buildCampaignRows,
  buildKeywordRows,
  buildSearchTermRows,
} from "@/features/marketing/providers/amazon-ads/insights/view-model";
import { AMAZON_ADS_RECOMMENDATION_THRESHOLDS } from "@/features/marketing/providers/amazon-ads/recommendations/config";
import type {
  AmazonAdsRecommendation,
  AmazonAdsRecommendationFilters,
  AmazonAdsRecommendationThresholds,
  RecommendationGenerationResult,
  RecommendationPriority,
  RecommendationSummary,
  RecommendationType,
} from "@/features/marketing/providers/amazon-ads/recommendations/types";
import type { AmazonAdsInsightRecord } from "@/features/marketing/providers/amazon-ads/insights/types";

const STATUS: AmazonAdsRecommendation["status"] = "Read Only — No changes applied";

const PRIORITY_ORDER: RecommendationPriority[] = ["critical", "high", "medium", "low"];

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function buildRecommendationId(type: RecommendationType, ...parts: Array<string | null>): string {
  return [type, ...parts.filter((part): part is string => Boolean(part))].join(":");
}

function enforceReadOnlySandbox(records: AmazonAdsInsightRecord[]): void {
  const workspaceIds = new Set(records.map((row) => row.workspaceId));
  const providerIds = new Set(records.map((row) => row.providerId));

  if (workspaceIds.size !== 1 || providerIds.size !== 1) {
    throw new Error("Amazon Ads recommendations require a single workspace and provider scope.");
  }
  if (![...providerIds][0].includes("sandbox")) {
    throw new Error("Amazon Ads recommendations only support sandbox data.");
  }
}

function emptySummary(): RecommendationSummary {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

function summarize(recommendations: AmazonAdsRecommendation[]): RecommendationSummary {
  const summary = emptySummary();
  for (const rec of recommendations) summary[rec.priority] += 1;
  return summary;
}

function baseRecommendation(
  input: Omit<AmazonAdsRecommendation, "status">,
): AmazonAdsRecommendation {
  return {
    ...input,
    confidenceScore: round(Math.min(Math.max(input.confidenceScore, 0), 1), 2),
    status: STATUS,
  };
}

function buildDecliningRoasMap(records: AmazonAdsInsightRecord[]): Map<string, { first: number; second: number; dropPercent: number }> {
  const byCampaign = new Map<string, Map<string, { spend: number; sales: number }>>();

  for (const row of records) {
    const campaign = byCampaign.get(row.campaignId) || new Map<string, { spend: number; sales: number }>();
    const day = campaign.get(row.date) || { spend: 0, sales: 0 };
    day.spend += row.spend;
    day.sales += row.sales;
    campaign.set(row.date, day);
    byCampaign.set(row.campaignId, campaign);
  }

  const result = new Map<string, { first: number; second: number; dropPercent: number }>();
  for (const [campaignId, byDay] of byCampaign.entries()) {
    const series = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => safeDivide(value.sales, value.spend));

    if (series.length < 2) continue;
    const mid = Math.ceil(series.length / 2);
    const first = safeDivide(series.slice(0, mid).reduce((sum, point) => sum + point, 0), mid);
    const secondWindow = series.length - mid;
    const second = safeDivide(series.slice(mid).reduce((sum, point) => sum + point, 0), secondWindow);
    const dropPercent = first > 0 ? ((first - second) / first) * 100 : 0;
    result.set(campaignId, { first: round(first), second: round(second), dropPercent: round(dropPercent) });
  }
  return result;
}

function recommendationFilterOptions(recommendations: AmazonAdsRecommendation[]) {
  const typeSet = new Set<RecommendationType>();
  const campaignMap = new Map<string, string>();
  const marketplaceSet = new Set<string>();

  for (const rec of recommendations) {
    typeSet.add(rec.type);
    marketplaceSet.add(rec.marketplaceId);
    if (rec.reference.campaignId) {
      campaignMap.set(rec.reference.campaignId, rec.reference.campaignName);
    }
  }

  return {
    priorities: PRIORITY_ORDER,
    types: [...typeSet].sort(),
    campaigns: [...campaignMap.entries()].map(([campaignId, campaignName]) => ({ campaignId, campaignName })),
    marketplaces: [...marketplaceSet].sort(),
  };
}

function inferPrimaryMarketplace(rows: AmazonAdsInsightRecord[], campaignId: string): string {
  const campaignRows = rows.filter((row) => row.campaignId === campaignId);
  const counts = new Map<string, number>();
  for (const row of campaignRows) counts.set(row.marketplaceId, (counts.get(row.marketplaceId) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "UNKNOWN";
}

export function generateAmazonAdsRecommendations(
  sourceRecords: AmazonAdsInsightRecord[],
  generatedAt: string,
  thresholds: AmazonAdsRecommendationThresholds = AMAZON_ADS_RECOMMENDATION_THRESHOLDS,
): RecommendationGenerationResult {
  enforceReadOnlySandbox(sourceRecords);
  if (sourceRecords.length === 0) {
    return {
      generatedAt,
      sourceRecords,
      recommendations: [],
      summary: emptySummary(),
      filterOptions: { priorities: PRIORITY_ORDER, types: [], campaigns: [], marketplaces: [] },
    };
  }

  const campaigns = buildCampaignRows(sourceRecords);
  const keywords = buildKeywordRows(sourceRecords);
  const terms = buildSearchTermRows(sourceRecords);
  const roasTrends = buildDecliningRoasMap(sourceRecords);
  const recommendations: AmazonAdsRecommendation[] = [];

  for (const term of terms) {
    const termRoas = safeDivide(term.sales, term.spend);
    const campaign = campaigns.find((row) => row.campaignName === term.campaignName);
    const marketplaceId = campaign ? inferPrimaryMarketplace(sourceRecords, campaign.campaignId) : "UNKNOWN";

    if (term.spend >= thresholds.highSpendSearchTermMinSpend && term.orders === 0 && term.clicks >= thresholds.highSpendSearchTermMinClicks) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("high_spend_zero_orders_search_term", campaign?.campaignId || null, term.searchTerm),
          type: "high_spend_zero_orders_search_term",
          priority: "critical",
          reference: {
            scope: "search-term",
            campaignId: campaign?.campaignId || null,
            campaignName: term.campaignName,
            keywordId: null,
            keyword: term.keyword,
            searchTerm: term.searchTerm,
          },
          marketplaceId,
          explanation: "This search term is spending significantly without generating any orders.",
          supportingMetrics: { clicks: term.clicks, spend: round(term.spend), orders: term.orders, sales: round(term.sales), roas: round(termRoas) },
          calculationEvidence: `Spend ${round(term.spend)} >= ${thresholds.highSpendSearchTermMinSpend} with ${term.clicks} clicks and 0 orders.`,
          confidenceScore: 0.96,
          estimatedImpactRange: { label: "Potential wasted spend reduction", low: round(term.spend * 0.6), high: round(term.spend * 0.95), unit: "USD" },
          suggestedAction: "Add this term as a negative keyword or reduce bidding on the matching keyword.",
        }),
      );
    }

    if (term.spend >= thresholds.negativeKeywordMinSpend && term.orders === 0 && term.clicks >= thresholds.negativeKeywordMinClicks) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("negative_keyword_candidate", campaign?.campaignId || null, term.searchTerm),
          type: "negative_keyword_candidate",
          priority: "high",
          reference: {
            scope: "search-term",
            campaignId: campaign?.campaignId || null,
            campaignName: term.campaignName,
            keywordId: null,
            keyword: term.keyword,
            searchTerm: term.searchTerm,
          },
          marketplaceId,
          explanation: "The term appears unqualified and repeatedly consumes spend without conversion.",
          supportingMetrics: { clicks: term.clicks, spend: round(term.spend), orders: term.orders, conversionRate: round(term.conversionRate) },
          calculationEvidence: `Clicks ${term.clicks} >= ${thresholds.negativeKeywordMinClicks} and spend ${round(term.spend)} >= ${thresholds.negativeKeywordMinSpend} while orders remain 0.`,
          confidenceScore: 0.89,
          estimatedImpactRange: { label: "Estimated monthly spend savings", low: round(term.spend * 0.5), high: round(term.spend * 0.85), unit: "USD" },
          suggestedAction: "Add the term to negative keywords at campaign or ad-group level.",
        }),
      );
    }

    if (term.orders >= thresholds.profitableTermMinOrders && termRoas >= thresholds.profitableTermMinRoas && term.clicks >= thresholds.profitableTermMinClicks) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("profitable_search_term_keyword_candidate", campaign?.campaignId || null, term.searchTerm),
          type: "profitable_search_term_keyword_candidate",
          priority: "medium",
          reference: {
            scope: "search-term",
            campaignId: campaign?.campaignId || null,
            campaignName: term.campaignName,
            keywordId: null,
            keyword: term.keyword,
            searchTerm: term.searchTerm,
          },
          marketplaceId,
          explanation: "This search term has strong conversion and return, making it a good standalone keyword candidate.",
          supportingMetrics: { orders: term.orders, roas: round(termRoas), spend: round(term.spend), sales: round(term.sales) },
          calculationEvidence: `Orders ${term.orders} >= ${thresholds.profitableTermMinOrders} and ROAS ${round(termRoas)} >= ${thresholds.profitableTermMinRoas}.`,
          confidenceScore: 0.83,
          estimatedImpactRange: { label: "Estimated incremental sales opportunity", low: round(term.sales * 0.08), high: round(term.sales * 0.2), unit: "USD" },
          suggestedAction: "Promote this term into exact or phrase match keyword targets with dedicated bids.",
        }),
      );
    }
  }

  for (const keyword of keywords) {
    const campaign = campaigns.find((row) => row.campaignName === keyword.campaignName);
    const marketplaceId = campaign ? inferPrimaryMarketplace(sourceRecords, campaign.campaignId) : "UNKNOWN";

    if (keyword.spend >= thresholds.keywordHighAcosMinSpend && keyword.acos >= thresholds.keywordHighAcosThreshold) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("high_acos_keyword", campaign?.campaignId || null, keyword.keywordId),
          type: "high_acos_keyword",
          priority: keyword.acos >= thresholds.bidDecreaseAcosThreshold ? "high" : "medium",
          reference: {
            scope: "keyword",
            campaignId: campaign?.campaignId || null,
            campaignName: keyword.campaignName,
            keywordId: keyword.keywordId,
            keyword: keyword.keyword,
            searchTerm: null,
          },
          marketplaceId,
          explanation: "This keyword is spending inefficiently relative to generated sales.",
          supportingMetrics: { impressions: keyword.impressions, clicks: keyword.clicks, spend: round(keyword.spend), sales: round(keyword.sales), acos: round(keyword.acos), roas: round(keyword.roas) },
          calculationEvidence: `ACOS ${round(keyword.acos)}% >= ${thresholds.keywordHighAcosThreshold}% with spend ${round(keyword.spend)} >= ${thresholds.keywordHighAcosMinSpend}.`,
          confidenceScore: 0.85,
          estimatedImpactRange: { label: "Potential ACOS improvement", low: 5, high: 20, unit: "PERCENT" },
          suggestedAction: "Lower bid or tighten matching to improve efficiency on this keyword.",
        }),
      );
    }

    if (keyword.impressions <= thresholds.keywordLowImpressionsThreshold && keyword.clicks <= thresholds.keywordLowImpressionsMinClicks) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("low_impressions_keyword", campaign?.campaignId || null, keyword.keywordId),
          type: "low_impressions_keyword",
          priority: "low",
          reference: {
            scope: "keyword",
            campaignId: campaign?.campaignId || null,
            campaignName: keyword.campaignName,
            keywordId: keyword.keywordId,
            keyword: keyword.keyword,
            searchTerm: null,
          },
          marketplaceId,
          explanation: "The keyword is not receiving enough impressions to produce statistically reliable performance data.",
          supportingMetrics: { impressions: keyword.impressions, clicks: keyword.clicks, spend: round(keyword.spend) },
          calculationEvidence: `Impressions ${keyword.impressions} <= ${thresholds.keywordLowImpressionsThreshold} and clicks ${keyword.clicks} <= ${thresholds.keywordLowImpressionsMinClicks}.`,
          confidenceScore: 0.76,
          estimatedImpactRange: { label: "Potential traffic lift if expanded", low: 10, high: 45, unit: "PERCENT" },
          suggestedAction: "Expand match coverage or increase bid slightly to gain more auction participation.",
        }),
      );
    }

    if (keyword.acos >= thresholds.bidDecreaseAcosThreshold && keyword.clicks >= thresholds.bidDecreaseMinClicks && keyword.spend >= thresholds.bidDecreaseMinSpend) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("bid_decrease_candidate", campaign?.campaignId || null, keyword.keywordId),
          type: "bid_decrease_candidate",
          priority: "high",
          reference: {
            scope: "keyword",
            campaignId: campaign?.campaignId || null,
            campaignName: keyword.campaignName,
            keywordId: keyword.keywordId,
            keyword: keyword.keyword,
            searchTerm: null,
          },
          marketplaceId,
          explanation: "Keyword bid appears too aggressive relative to conversion value.",
          supportingMetrics: { clicks: keyword.clicks, spend: round(keyword.spend), orders: keyword.orders, acos: round(keyword.acos) },
          calculationEvidence: `ACOS ${round(keyword.acos)} >= ${thresholds.bidDecreaseAcosThreshold}, clicks ${keyword.clicks} >= ${thresholds.bidDecreaseMinClicks}.`,
          confidenceScore: 0.88,
          estimatedImpactRange: { label: "Potential spend efficiency gain", low: 8, high: 22, unit: "PERCENT" },
          suggestedAction: "Decrease bid in controlled steps and monitor conversion retention.",
        }),
      );
    }

    if (keyword.roas >= thresholds.bidIncreaseMinRoas && keyword.orders >= thresholds.bidIncreaseMinOrders && keyword.clicks >= thresholds.bidIncreaseMinClicks) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("bid_increase_candidate", campaign?.campaignId || null, keyword.keywordId),
          type: "bid_increase_candidate",
          priority: "medium",
          reference: {
            scope: "keyword",
            campaignId: campaign?.campaignId || null,
            campaignName: keyword.campaignName,
            keywordId: keyword.keywordId,
            keyword: keyword.keyword,
            searchTerm: null,
          },
          marketplaceId,
          explanation: "The keyword is profitable and has enough volume to justify controlled scaling.",
          supportingMetrics: { clicks: keyword.clicks, orders: keyword.orders, spend: round(keyword.spend), sales: round(keyword.sales), roas: round(keyword.roas) },
          calculationEvidence: `ROAS ${round(keyword.roas)} >= ${thresholds.bidIncreaseMinRoas}, orders ${keyword.orders} >= ${thresholds.bidIncreaseMinOrders}.`,
          confidenceScore: 0.82,
          estimatedImpactRange: { label: "Estimated incremental sales from bid lift", low: round(keyword.sales * 0.05), high: round(keyword.sales * 0.18), unit: "USD" },
          suggestedAction: "Increase bid gradually to capture additional profitable traffic.",
        }),
      );
    }
  }

  const strongCampaigns = campaigns.filter(
    (campaign) =>
      campaign.roas >= thresholds.budgetReallocationStrongRoasThreshold &&
      campaign.spend >= thresholds.budgetReallocationMinStrongSpend,
  );
  const weakCampaigns = campaigns.filter(
    (campaign) =>
      campaign.roas > 0 &&
      campaign.roas <= thresholds.budgetReallocationWeakRoasThreshold &&
      campaign.spend >= thresholds.budgetReallocationMinWeakSpend,
  );

  for (const campaign of campaigns) {
    const marketplaceId = inferPrimaryMarketplace(sourceRecords, campaign.campaignId);
    const budgetRatio = safeDivide(campaign.spend, campaign.budget);
    const trend = roasTrends.get(campaign.campaignId);

    if (campaign.spend >= thresholds.budgetLimitedMinSpend && budgetRatio >= thresholds.budgetLimitedSpendRatioThreshold) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("budget_limited_campaign", campaign.campaignId),
          type: "budget_limited_campaign",
          priority: campaign.roas >= thresholds.scaleCandidateMinRoas ? "high" : "medium",
          reference: {
            scope: "campaign",
            campaignId: campaign.campaignId,
            campaignName: campaign.campaignName,
            keywordId: null,
            keyword: null,
            searchTerm: null,
          },
          marketplaceId,
          explanation: "Campaign spend is close to budget ceiling, which may cap delivery before demand is exhausted.",
          supportingMetrics: { budget: round(campaign.budget), spend: round(campaign.spend), spendToBudgetRatio: round(budgetRatio * 100), roas: round(campaign.roas) },
          calculationEvidence: `Spend/Budget ratio ${round(budgetRatio * 100)}% >= ${round(thresholds.budgetLimitedSpendRatioThreshold * 100)}%.`,
          confidenceScore: 0.84,
          estimatedImpactRange: { label: "Possible incremental revenue if unconstrained", low: round(campaign.sales * 0.06), high: round(campaign.sales * 0.2), unit: "USD" },
          suggestedAction: "Consider increasing budget if the campaign remains profitable.",
        }),
      );
    }

    if (
      campaign.spend >= thresholds.campaignWastedSpendMinSpend &&
      campaign.orders === 0 &&
      (campaign.sales <= 0 || campaign.acos >= thresholds.campaignWastedSpendAcosThreshold)
    ) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("campaign_wasted_spend", campaign.campaignId),
          type: "campaign_wasted_spend",
          priority: "critical",
          reference: {
            scope: "campaign",
            campaignId: campaign.campaignId,
            campaignName: campaign.campaignName,
            keywordId: null,
            keyword: null,
            searchTerm: null,
          },
          marketplaceId,
          explanation: "Campaign spend is being consumed without attributed orders.",
          supportingMetrics: { spend: round(campaign.spend), sales: round(campaign.sales), orders: campaign.orders, acos: round(campaign.acos) },
          calculationEvidence: `Orders = 0, spend ${round(campaign.spend)} >= ${thresholds.campaignWastedSpendMinSpend}, ACOS ${round(campaign.acos)} >= ${thresholds.campaignWastedSpendAcosThreshold}.`,
          confidenceScore: 0.97,
          estimatedImpactRange: { label: "Potential waste reduction", low: round(campaign.spend * 0.6), high: round(campaign.spend * 0.95), unit: "USD" },
          suggestedAction: "Review targeting and search term quality before allocating additional spend.",
        }),
      );
    }

    if (trend && trend.dropPercent >= thresholds.decliningRoasDropPercentThreshold && sourceRecords.filter((row) => row.campaignId === campaign.campaignId).length >= thresholds.decliningRoasMinDailyPoints) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("campaign_declining_roas", campaign.campaignId),
          type: "campaign_declining_roas",
          priority: "high",
          reference: {
            scope: "campaign",
            campaignId: campaign.campaignId,
            campaignName: campaign.campaignName,
            keywordId: null,
            keyword: null,
            searchTerm: null,
          },
          marketplaceId,
          explanation: "Recent campaign return on ad spend is declining versus earlier performance.",
          supportingMetrics: { roasFirstWindow: trend.first, roasSecondWindow: trend.second, roasDropPercent: trend.dropPercent },
          calculationEvidence: `ROAS drop ${trend.dropPercent}% >= ${thresholds.decliningRoasDropPercentThreshold}% across sequential windows.`,
          confidenceScore: 0.81,
          estimatedImpactRange: { label: "Potential ROAS recovery", low: 8, high: 25, unit: "PERCENT" },
          suggestedAction: "Audit recent query mix, bids, and placements to reverse declining efficiency.",
        }),
      );
    }

    if (campaign.roas >= thresholds.scaleCandidateMinRoas && campaign.orders >= thresholds.scaleCandidateMinOrders && campaign.spend >= thresholds.scaleCandidateMinSpend) {
      recommendations.push(
        baseRecommendation({
          id: buildRecommendationId("strong_campaign_scale_candidate", campaign.campaignId),
          type: "strong_campaign_scale_candidate",
          priority: "medium",
          reference: {
            scope: "campaign",
            campaignId: campaign.campaignId,
            campaignName: campaign.campaignName,
            keywordId: null,
            keyword: null,
            searchTerm: null,
          },
          marketplaceId,
          explanation: "Campaign is consistently profitable with enough order volume to support cautious scaling.",
          supportingMetrics: { spend: round(campaign.spend), sales: round(campaign.sales), roas: round(campaign.roas), orders: campaign.orders },
          calculationEvidence: `ROAS ${round(campaign.roas)} >= ${thresholds.scaleCandidateMinRoas}, orders ${campaign.orders} >= ${thresholds.scaleCandidateMinOrders}.`,
          confidenceScore: 0.86,
          estimatedImpactRange: { label: "Estimated incremental revenue with scale", low: round(campaign.sales * 0.08), high: round(campaign.sales * 0.25), unit: "USD" },
          suggestedAction: "Allocate incremental budget and broaden keyword coverage while monitoring efficiency.",
        }),
      );
    }
  }

  if (strongCampaigns.length > 0 && weakCampaigns.length > 0) {
    const strongest = strongCampaigns.sort((a, b) => b.roas - a.roas)[0];
    const weakest = weakCampaigns.sort((a, b) => a.roas - b.roas)[0];
    const transferable = round(Math.min(weakest.spend * 0.2, weakest.budget * 0.2));
    recommendations.push(
      baseRecommendation({
        id: buildRecommendationId("budget_reallocation", strongest.campaignId, weakest.campaignId),
        type: "budget_reallocation",
        priority: "high",
        reference: {
          scope: "portfolio",
          campaignId: strongest.campaignId,
          campaignName: `${strongest.campaignName} ↔ ${weakest.campaignName}`,
          keywordId: null,
          keyword: null,
          searchTerm: null,
        },
        marketplaceId: inferPrimaryMarketplace(sourceRecords, strongest.campaignId),
        explanation: "Budget can be shifted from lower-return to higher-return campaigns to improve aggregate efficiency.",
        supportingMetrics: {
          strongCampaignRoas: round(strongest.roas),
          weakCampaignRoas: round(weakest.roas),
          strongCampaignSpend: round(strongest.spend),
          weakCampaignSpend: round(weakest.spend),
          suggestedTransfer: transferable,
        },
        calculationEvidence: `Strong ROAS ${round(strongest.roas)} >= ${thresholds.budgetReallocationStrongRoasThreshold}; weak ROAS ${round(weakest.roas)} <= ${thresholds.budgetReallocationWeakRoasThreshold}.`,
        confidenceScore: 0.78,
        estimatedImpactRange: { label: "Estimated net revenue improvement", low: round(transferable * 1.2), high: round(transferable * 2.8), unit: "USD" },
        suggestedAction: "Reallocate a portion of budget from weak campaign to stronger campaign and monitor blended ROAS.",
      }),
    );
  }

  const deduped = [...new Map(recommendations.map((rec) => [rec.id, rec])).values()];

  return {
    generatedAt,
    sourceRecords,
    recommendations: deduped,
    summary: summarize(deduped),
    filterOptions: recommendationFilterOptions(deduped),
  };
}

export function filterAmazonAdsRecommendations(
  recommendations: AmazonAdsRecommendation[],
  filters: AmazonAdsRecommendationFilters,
): AmazonAdsRecommendation[] {
  return recommendations.filter((rec) => {
    if (filters.priority !== "ALL" && rec.priority !== filters.priority) return false;
    if (filters.type !== "ALL" && rec.type !== filters.type) return false;
    if (filters.campaignId !== "ALL" && rec.reference.campaignId !== filters.campaignId) return false;
    if (filters.marketplaceId !== "ALL" && rec.marketplaceId !== filters.marketplaceId) return false;
    return true;
  });
}
