import { AMAZON_ADS_INSIGHT_FIXTURE } from "@/features/marketing/providers/amazon-ads/insights/fixtures";
import type {
  AmazonAdsDashboardViewModel,
  AmazonAdsInsightRecord,
  AmazonAdsInsightsFilter,
} from "@/features/marketing/providers/amazon-ads/insights/types";
import {
  applyDashboardFilters,
  buildCampaignRows,
  buildDashboardViewModel,
  buildKeywordRows,
  buildSearchTermRows,
  buildTrendPoints,
  computeOverviewMetrics,
} from "@/features/marketing/providers/amazon-ads/insights/view-model";

function enforceReadOnlySandbox(records: AmazonAdsInsightRecord[]): void {
  const workspaceIds = new Set(records.map((row) => row.workspaceId));
  const providerIds = new Set(records.map((row) => row.providerId));

  if (workspaceIds.size > 1 || providerIds.size > 1) {
    throw new Error("Amazon Ads insights dashboard requires a single workspace and provider scope.");
  }

  for (const row of records) {
    if (!row.providerId.includes("sandbox")) {
      throw new Error("Amazon Ads insights dashboard only supports sandbox data.");
    }
  }
}

export async function getAmazonAdsInsightsDashboard(): Promise<AmazonAdsDashboardViewModel> {
  enforceReadOnlySandbox(AMAZON_ADS_INSIGHT_FIXTURE);
  return buildDashboardViewModel(AMAZON_ADS_INSIGHT_FIXTURE, new Date().toISOString());
}

export function getFilteredDashboard(
  baseRecords: AmazonAdsInsightRecord[],
  generatedAt: string,
  filter: AmazonAdsInsightsFilter,
): AmazonAdsDashboardViewModel {
  enforceReadOnlySandbox(baseRecords);
  const base = buildDashboardViewModel(baseRecords, generatedAt);
  const filtered = applyDashboardFilters(baseRecords, filter);

  return {
    ...base,
    sourceRecords: baseRecords,
    filters: {
      ...base.filters,
      defaults: filter,
    },
    overview: computeOverviewMetrics(filtered),
    trend: buildTrendPoints(filtered),
    campaigns: buildCampaignRows(filtered),
    keywords: buildKeywordRows(filtered),
    searchTerms: buildSearchTermRows(filtered),
  };
}
