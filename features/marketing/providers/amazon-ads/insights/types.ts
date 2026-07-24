export type AmazonAdsInsightsFilter = {
  startDate: string;
  endDate: string;
  marketplaceId: string;
  profileId: string;
  campaignStatus: string;
};

export type AmazonAdsInsightRecord = {
  workspaceId: string;
  providerId: string;
  campaignId: string;
  campaignName: string;
  campaignType: string;
  campaignStatus: string;
  budget: number;
  keywordId: string;
  keyword: string;
  matchType: string;
  searchTerm: string;
  marketplaceId: string;
  profileId: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
};

export type OverviewMetrics = {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  acos: number;
  roas: number;
};

export type TrendPoint = {
  date: string;
  spend: number;
  sales: number;
  acos: number;
  roas: number;
};

export type CampaignRow = {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  campaignStatus: string;
  budget: number;
  spend: number;
  sales: number;
  orders: number;
  acos: number;
  roas: number;
};

export type KeywordRow = {
  keywordId: string;
  keyword: string;
  matchType: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  sales: number;
  acos: number;
  roas: number;
};

export type SearchTermRow = {
  searchTerm: string;
  keyword: string;
  campaignName: string;
  clicks: number;
  spend: number;
  orders: number;
  sales: number;
  conversionRate: number;
  acos: number;
};

export type AmazonAdsDashboardViewModel = {
  readOnly: true;
  sandboxOnly: true;
  generatedAt: string;
  sourceRecords: AmazonAdsInsightRecord[];
  filters: {
    dateRange: { min: string; max: string };
    marketplaces: string[];
    profiles: string[];
    campaignStatuses: string[];
    defaults: AmazonAdsInsightsFilter;
  };
  overview: OverviewMetrics;
  trend: TrendPoint[];
  campaigns: CampaignRow[];
  keywords: KeywordRow[];
  searchTerms: SearchTermRow[];
};
