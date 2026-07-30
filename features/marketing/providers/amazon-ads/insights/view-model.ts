import type {
  AmazonAdsDashboardViewModel,
  AmazonAdsInsightRecord,
  AmazonAdsInsightsFilter,
  CampaignRow,
  KeywordRow,
  OverviewMetrics,
  SearchTermRow,
  TrendPoint,
} from "@/features/marketing/providers/amazon-ads/insights/types";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

export function computeOverviewMetrics(records: AmazonAdsInsightRecord[]): OverviewMetrics {
  const totals = records.reduce(
    (acc, row) => {
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.spend += row.spend;
      acc.sales += row.sales;
      acc.orders += row.orders;
      return acc;
    },
    { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 },
  );

  return {
    ...totals,
    ctr: round(safeDivide(totals.clicks * 100, totals.impressions)),
    cpc: round(safeDivide(totals.spend, totals.clicks)),
    conversionRate: round(safeDivide(totals.orders * 100, totals.clicks)),
    acos: round(safeDivide(totals.spend * 100, totals.sales)),
    roas: round(safeDivide(totals.sales, totals.spend)),
  };
}

export function applyDashboardFilters(
  records: AmazonAdsInsightRecord[],
  filters: AmazonAdsInsightsFilter,
): AmazonAdsInsightRecord[] {
  return records.filter((row) => {
    if (row.date < filters.startDate || row.date > filters.endDate) return false;
    if (filters.marketplaceId !== "ALL" && row.marketplaceId !== filters.marketplaceId) return false;
    if (filters.profileId !== "ALL" && row.profileId !== filters.profileId) return false;
    if (filters.campaignStatus !== "ALL" && row.campaignStatus !== filters.campaignStatus) return false;
    return true;
  });
}

export function buildTrendPoints(records: AmazonAdsInsightRecord[]): TrendPoint[] {
  const byDate = new Map<string, { spend: number; sales: number }>();
  for (const row of records) {
    const existing = byDate.get(row.date) || { spend: 0, sales: 0 };
    existing.spend += row.spend;
    existing.sales += row.sales;
    byDate.set(row.date, existing);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      spend: round(values.spend),
      sales: round(values.sales),
      acos: round(safeDivide(values.spend * 100, values.sales)),
      roas: round(safeDivide(values.sales, values.spend)),
    }));
}

export function buildCampaignRows(records: AmazonAdsInsightRecord[]): CampaignRow[] {
  const byCampaign = new Map<string, CampaignRow>();
  for (const row of records) {
    const existing =
      byCampaign.get(row.campaignId) ||
      {
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        campaignType: row.campaignType,
        campaignStatus: row.campaignStatus,
        budget: row.budget,
        spend: 0,
        sales: 0,
        orders: 0,
        acos: 0,
        roas: 0,
      };
    existing.spend += row.spend;
    existing.sales += row.sales;
    existing.orders += row.orders;
    existing.acos = round(safeDivide(existing.spend * 100, existing.sales));
    existing.roas = round(safeDivide(existing.sales, existing.spend));
    byCampaign.set(row.campaignId, existing);
  }
  return [...byCampaign.values()].sort((a, b) => b.spend - a.spend);
}

export function buildKeywordRows(records: AmazonAdsInsightRecord[]): KeywordRow[] {
  const byKeyword = new Map<string, KeywordRow>();
  for (const row of records) {
    const key = `${row.campaignId}:${row.keywordId}`;
    const existing =
      byKeyword.get(key) ||
      {
        keywordId: row.keywordId,
        keyword: row.keyword,
        matchType: row.matchType,
        campaignName: row.campaignName,
        impressions: 0,
        clicks: 0,
        spend: 0,
        orders: 0,
        sales: 0,
        acos: 0,
        roas: 0,
      };
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.spend += row.spend;
    existing.orders += row.orders;
    existing.sales += row.sales;
    existing.acos = round(safeDivide(existing.spend * 100, existing.sales));
    existing.roas = round(safeDivide(existing.sales, existing.spend));
    byKeyword.set(key, existing);
  }
  return [...byKeyword.values()].sort((a, b) => b.spend - a.spend);
}

export function buildSearchTermRows(records: AmazonAdsInsightRecord[]): SearchTermRow[] {
  const byTerm = new Map<string, SearchTermRow>();
  for (const row of records) {
    const key = `${row.campaignId}:${row.keywordId}:${row.searchTerm}`;
    const existing =
      byTerm.get(key) ||
      {
        searchTerm: row.searchTerm,
        keyword: row.keyword,
        campaignName: row.campaignName,
        clicks: 0,
        spend: 0,
        orders: 0,
        sales: 0,
        conversionRate: 0,
        acos: 0,
      };
    existing.clicks += row.clicks;
    existing.spend += row.spend;
    existing.orders += row.orders;
    existing.sales += row.sales;
    existing.conversionRate = round(safeDivide(existing.orders * 100, existing.clicks));
    existing.acos = round(safeDivide(existing.spend * 100, existing.sales));
    byTerm.set(key, existing);
  }
  return [...byTerm.values()].sort((a, b) => b.spend - a.spend);
}

export function buildDashboardViewModel(
  records: AmazonAdsInsightRecord[],
  generatedAt: string,
  sourceMode: "SANDBOX" | "LIVE" = "SANDBOX",
): AmazonAdsDashboardViewModel {
  const dates = [...new Set(records.map((row) => row.date))].sort();
  const marketplaces = [...new Set(records.map((row) => row.marketplaceId))].sort();
  const profiles = [...new Set(records.map((row) => row.profileId))].sort();
  const campaignStatuses = [...new Set(records.map((row) => row.campaignStatus))].sort();

  const minDate = dates[0] || generatedAt.slice(0, 10);
  const maxDate = dates[dates.length - 1] || generatedAt.slice(0, 10);

  const defaults: AmazonAdsInsightsFilter = {
    startDate: minDate,
    endDate: maxDate,
    marketplaceId: "ALL",
    profileId: "ALL",
    campaignStatus: "ALL",
  };

  const filtered = applyDashboardFilters(records, defaults);

  return {
    readOnly: true,
    sandboxOnly: sourceMode === "SANDBOX",
    sourceMode,
    generatedAt,
    sourceRecords: records,
    filters: {
      dateRange: { min: minDate, max: maxDate },
      marketplaces,
      profiles,
      campaignStatuses,
      defaults,
    },
    overview: computeOverviewMetrics(filtered),
    trend: buildTrendPoints(filtered),
    campaigns: buildCampaignRows(filtered),
    keywords: buildKeywordRows(filtered),
    searchTerms: buildSearchTermRows(filtered),
  };
}
