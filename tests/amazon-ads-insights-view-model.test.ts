import { describe, expect, it } from "vitest";
import { AMAZON_ADS_INSIGHT_FIXTURE } from "@/features/marketing/providers/amazon-ads/insights/fixtures";
import { getFilteredDashboard } from "@/features/marketing/providers/amazon-ads/insights/service";
import { applyDashboardFilters, computeOverviewMetrics } from "@/features/marketing/providers/amazon-ads/insights/view-model";

describe("Amazon Ads insights dashboard view-model", () => {
  it("avoids division errors by returning zeroed rates", () => {
    const metrics = computeOverviewMetrics([
      {
        workspaceId: "ws_1",
        providerId: "amazon-ads-sandbox",
        campaignId: "c1",
        campaignName: "Campaign",
        campaignType: "SPONSORED_PRODUCTS",
        campaignStatus: "ENABLED",
        budget: 10,
        keywordId: "k1",
        keyword: "keyword",
        matchType: "EXACT",
        searchTerm: "keyword",
        marketplaceId: "US",
        profileId: "profile-1",
        date: "2026-03-01",
        impressions: 0,
        clicks: 0,
        spend: 0,
        sales: 0,
        orders: 0,
      },
    ]);

    expect(metrics.ctr).toBe(0);
    expect(metrics.cpc).toBe(0);
    expect(metrics.conversionRate).toBe(0);
    expect(metrics.acos).toBe(0);
    expect(metrics.roas).toBe(0);
  });

  it("applies date, marketplace, profile, and campaign status filters", () => {
    const filtered = applyDashboardFilters(AMAZON_ADS_INSIGHT_FIXTURE, {
      startDate: "2026-03-02",
      endDate: "2026-03-03",
      marketplaceId: "US",
      profileId: "profile-us-001",
      campaignStatus: "PAUSED",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].campaignName).toContain("SB");
  });

  it("enforces single-scope sandbox isolation for dashboard data", () => {
    expect(() =>
      getFilteredDashboard(
        [
          ...AMAZON_ADS_INSIGHT_FIXTURE,
          {
            ...AMAZON_ADS_INSIGHT_FIXTURE[0],
            workspaceId: "ws_2",
            providerId: "amazon-ads-sandbox",
            campaignId: "c2",
          },
        ],
        "2026-03-04T00:00:00.000Z",
        {
          startDate: "2026-03-01",
          endDate: "2026-03-04",
          marketplaceId: "ALL",
          profileId: "ALL",
          campaignStatus: "ALL",
        },
      ),
    ).toThrow("single workspace and provider scope");
  });

  it("rejects non-sandbox provider rows", () => {
    expect(() =>
      getFilteredDashboard(
        [
          {
            ...AMAZON_ADS_INSIGHT_FIXTURE[0],
            providerId: "amazon-ads-live",
          },
        ],
        "2026-03-04T00:00:00.000Z",
        {
          startDate: "2026-03-01",
          endDate: "2026-03-04",
          marketplaceId: "ALL",
          profileId: "ALL",
          campaignStatus: "ALL",
        },
      ),
    ).toThrow("sandbox data");
  });
});
